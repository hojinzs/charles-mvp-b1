import { Router } from "express";
import multer from "multer";
import {
  createBulkSearch,
  getBulkSearchById,
  getBulkSearchesPaginated,
  getBulkSearchKeywordsPaginated,
  insertBulkSearchKeywordsBatch,
  updateBulkSearchCounts,
  deleteBulkSearch,
  getAllBulkSearchKeywords,
  findKeywordByKeywordAndUrl,
} from "../../db/queries";
import {
  parseExcelFile,
  generateExcelFile,
  generateTemplateFile,
} from "../../utils/excelParser";
import { crawlQueue } from "../../queue/crawlQueue";

const router = Router();
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

// Environment variables
const MONITORING_INTERVAL_MS = parseInt(
  process.env.BULK_SEARCH_MONITORING_INTERVAL_MS || "86400000"
); // 24 hours

/**
 * @swagger
 * /bulk-searches/template:
 *   get:
 *     summary: Download bulk search template Excel file
 *     tags: [Bulk Searches]
 *     responses:
 *       200:
 *         description: Template file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/template", (req, res) => {
  try {
    const buffer = generateTemplateFile();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="bulk-search-template.xlsx"'
    );
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /bulk-searches/upload:
 *   post:
 *     summary: Upload Excel file for bulk search
 *     tags: [Bulk Searches]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk search created
 *       400:
 *         description: No file uploaded or parsing error
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "파일이 업로드되지 않았습니다." });
    }

    const name = req.body.name || null;
    const filename = req.file.originalname;

    console.log(`[BulkSearch] Parsing file: ${filename}`);

    // Parse Excel file
    const { keywords, errors } = parseExcelFile(req.file.buffer);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "엑셀 파일 파싱 오류",
        details: errors,
      });
    }

    if (keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: "유효한 키워드가 없습니다.",
      });
    }

    console.log(`[BulkSearch] Parsed ${keywords.length} keywords`);

    // Create bulk search record
    const bulkSearch = await createBulkSearch(filename, name, keywords.length);
    console.log(`[BulkSearch] Created bulk search ID: ${bulkSearch.id}`);

    // Process keywords in batches
    const BATCH_SIZE = 100;
    const threshold = new Date(Date.now() - MONITORING_INTERVAL_MS);

    let totalCached = 0;
    let totalPending = 0;

    try {
      for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
        const batch = keywords.slice(i, i + BATCH_SIZE);
        const batchData = [];

        for (const kw of batch) {
          // Check if keyword exists and has recent data
          const existingKeyword = await findKeywordByKeywordAndUrl(
            kw.keyword,
            kw.url
          );

          if (
            existingKeyword &&
            existingKeyword.last_checked_at &&
            new Date(existingKeyword.last_checked_at) > threshold
          ) {
            // Use cached result
            batchData.push({
              keyword: kw.keyword,
              url: kw.url,
              status: "cached",
              rank: existingKeyword.last_rank,
              cachedFrom: existingKeyword.last_checked_at,
            });
            totalCached++;
          } else {
            // Mark as pending and will add to queue
            batchData.push({
              keyword: kw.keyword,
              url: kw.url,
              status: "pending",
              rank: null,
              cachedFrom: null,
            });
            totalPending++;
          }
        }

        // Batch insert
        await insertBulkSearchKeywordsBatch(bulkSearch.id, batchData);
        console.log(
          `[BulkSearch] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(keywords.length / BATCH_SIZE)}`
        );
      }

      // Update counts
      await updateBulkSearchCounts(bulkSearch.id, totalCached, totalPending);
    } catch (e) {
      // Ensure we do not leave a partially populated bulk search in case of failure
      try {
        await deleteBulkSearch(bulkSearch.id);
      } catch (cleanupError) {
        console.error(
          `[BulkSearch] Failed to cleanup bulk search ${bulkSearch.id} after error:`,
          cleanupError
        );
      }
      throw e;
    }
    // Add pending keywords to queue (with priority)
    console.log(`[BulkSearch] Adding ${totalPending} keywords to queue...`);

    // Get all bulk search keywords that are pending
    const allKeywords = await getAllBulkSearchKeywords(bulkSearch.id);
    const pendingKeywords = allKeywords.filter((kw) => kw.status === "pending");

    // Get existing jobs in queue to check for duplicates
    const waitingJobs = await crawlQueue.getJobs(['waiting', 'delayed']);
    console.log(`[BulkSearch] Found ${waitingJobs.length} existing jobs in queue`);

    let queuedCount = 0;
    let reQueuedCount = 0;
    let skippedCount = 0;

    for (const kw of pendingKeywords) {
      try {
        // Check if keyword exists in main keywords table
        let keywordRecord = await findKeywordByKeywordAndUrl(kw.keyword, kw.url);

        // Find existing job for this keyword+URL combination
        const existingJob = waitingJobs.find((job) => {
          const jobData = job.data;
          return (
            jobData.keyword === kw.keyword &&
            jobData.targetUrl === kw.url
          );
        });

        if (existingJob) {
          const currentPriority = existingJob.opts.priority || 100;

          if (currentPriority !== 50) {
            // Remove existing job and re-add with priority 50
            console.log(
              `[BulkSearch] Re-queuing ${kw.keyword} (${kw.url}) - changing priority from ${currentPriority} to 50`
            );
            await existingJob.remove();

            await crawlQueue.add(
              {
                bulkSearchKeywordId: kw.id,
                keywordId: keywordRecord?.id || null,
                keyword: kw.keyword,
                targetUrl: kw.url,
                targetRank: null,
              },
              {
                priority: 50,
              }
            );
            reQueuedCount++;
          } else {
            // Already has priority 50, skip
            console.log(
              `[BulkSearch] Skipping ${kw.keyword} (${kw.url}) - already queued with priority 50`
            );
            skippedCount++;
          }
        } else {
          // No existing job, add new one
          await crawlQueue.add(
            {
              bulkSearchKeywordId: kw.id,
              keywordId: keywordRecord?.id || null,
              keyword: kw.keyword,
              targetUrl: kw.url,
              targetRank: null,
            },
            {
              priority: 50,
            }
          );
          queuedCount++;
        }
      } catch (e) {
        console.error(`[BulkSearch] Failed to add keyword to queue:`, e);
      }
    }

    console.log(
      `[BulkSearch] Queue results - New: ${queuedCount}, Re-queued: ${reQueuedCount}, Skipped: ${skippedCount}, Total: ${totalPending}`
    );

    res.json({
      success: true,
      data: {
        id: bulkSearch.id,
        totalCount: keywords.length,
        cachedCount: totalCached,
        pendingCount: totalPending,
        queuedCount,
      },
    });
  } catch (e: any) {
    console.error("[BulkSearch] Upload error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /bulk-searches:
 *   get:
 *     summary: Get bulk searches list with pagination
 *     tags: [Bulk Searches]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of bulk searches
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const result = await getBulkSearchesPaginated({ page, limit });

    res.json({
      success: true,
      data: {
        bulkSearches: result.data,
        total: result.total,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /bulk-searches/{id}:
 *   get:
 *     summary: Get bulk search details
 *     tags: [Bulk Searches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bulk search details
 *       404:
 *         description: Not found
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const bulkSearch = await getBulkSearchById(id);

    if (!bulkSearch) {
      return res
        .status(404)
        .json({ success: false, error: "Bulk search not found" });
    }

    res.json({ success: true, data: bulkSearch });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /bulk-searches/{id}/keywords:
 *   get:
 *     summary: Get keywords for a bulk search
 *     tags: [Bulk Searches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Keywords list
 */
router.get("/:id/keywords", async (req, res) => {
  try {
    const bulkSearchId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const status = req.query.status as string | undefined;

    const result = await getBulkSearchKeywordsPaginated({
      bulkSearchId,
      page,
      limit,
      status,
    });

    res.json({
      success: true,
      data: {
        keywords: result.data,
        total: result.total,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /bulk-searches/{id}/export:
 *   get:
 *     summary: Export bulk search results to Excel
 *     tags: [Bulk Searches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/export", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const bulkSearch = await getBulkSearchById(id);

    if (!bulkSearch) {
      return res
        .status(404)
        .json({ success: false, error: "Bulk search not found" });
    }

    // Get all keywords
    const keywords = await getAllBulkSearchKeywords(id);

    // Generate Excel file
    const buffer = generateExcelFile(keywords);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bulk-search-${id}-results.xlsx"`
    );
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /bulk-searches/{id}:
 *   delete:
 *     summary: Delete a bulk search
 *     tags: [Bulk Searches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await deleteBulkSearch(id);

    if (!result) {
      return res
        .status(404)
        .json({ success: false, error: "Bulk search not found" });
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
