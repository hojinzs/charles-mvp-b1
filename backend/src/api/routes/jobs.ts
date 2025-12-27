import { Router } from "express";
import { crawlQueue } from "../../queue/crawlQueue";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Job:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The job ID
 *         data:
 *           type: object
 *           properties:
 *             keywordId:
 *               type: integer
 *             keyword:
 *               type: string
 *             targetUrl:
 *               type: string
 *         status:
 *           type: string
 *           description: The status of the job
 *         progress:
 *           type: object
 *           description: Progress information
 *         result:
 *           type: object
 *           description: The result of the job
 *         finishedOn:
 *           type: integer
 *           format: int64
 *           description: Timestamp when the job finished
 */

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: The job queue management API
 */

/**
 * @swagger
 * /jobs/enqueue:
 *   post:
 *     summary: Enqueue a new crawl job
 *     tags: [Jobs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keywordId
 *               - keyword
 *               - targetUrl
 *             properties:
 *               keywordId:
 *                 type: integer
 *               keyword:
 *                 type: string
 *               targetUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     status:
 *                       type: string
 *       500:
 *         description: Server error
 */
router.post("/enqueue", async (req, res) => {
  try {
    const { keywordId, keyword, targetUrl, targetRank } = req.body;

    // In a real app we might verify keywordId exists in DB first

    const job = await crawlQueue.add({
      keywordId,
      keyword,
      targetUrl,
      targetRank,
    });

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: "waiting",
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /jobs/enqueue/priority:
 *   post:
 *     summary: Enqueue multiple keywords with high priority
 *     tags: [Jobs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Priority jobs enqueued
 *       500:
 *         description: Server error
 */
router.post("/enqueue/priority", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid keyword IDs" });
    }

    const { getKeywordsByIds } = await import("../../db/queries");
    const keywords = await getKeywordsByIds(ids);

    const results = [];
    for (const kw of keywords) {
      // 1. Check if job exists
      const existingJob = await crawlQueue.getJob(kw.id);
      if (existingJob) {
        const state = await existingJob.getState();
        // If it's already active, we don't bother moving it
        // If it's waiting/delayed/failed, we remove and re-add with priority
        if (state !== 'active') {
          await existingJob.remove();
        } else {
          results.push({ keywordId: kw.id, status: 'already_active' });
          continue;
        }
      }

      // 2. Add with priority 1 (high)
      const job = await crawlQueue.add({
        keywordId: kw.id,
        keyword: kw.keyword,
        targetUrl: kw.url,
        targetRank: kw.target_rank,
      }, {
        jobId: kw.id,
        priority: 1
      });

      results.push({ keywordId: kw.id, jobId: job.id, status: 'enqueued' });
    }

    res.json({ 
      success: true, 
      message: `${results.filter(r => r.status === 'enqueued').length} jobs enqueued with priority.`,
      data: results 
    });
  } catch (e: any) {
    console.error("[Priority Enqueue] Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /jobs/queue:
 *   get:
 *     summary: Get queue statistics and recent jobs
 *     tags: [Jobs]
 *     responses:
 *       200:
 *         description: Queue statistics and jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Queue counts and list of jobs
 *       500:
 *         description: Server error
 */
router.get("/queue", async (req, res) => {
  try {
    const counts = await crawlQueue.getJobCounts();
    const jobs = await crawlQueue.getJobs(
      ["active", "waiting", "delayed"],
      0,
      100 // Limit to 100 recent jobs to avoid performance issues
    );

    // Fetch state for each job
    const jobsWithState = await Promise.all(
      jobs.map(async (j) => {
        const state = await j.getState();
        return {
          id: j.id,
          data: j.data,
          status: state,
          progress: j.progress(),
          finishedOn: j.finishedOn,
          failedReason: j.failedReason,
        };
      })
    );

    res.json({
      success: true,
      data: {
        ...counts,
        jobs: jobsWithState,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /jobs/{id}:
 *   delete:
 *     summary: Delete a job by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The job ID
 *     responses:
 *       200:
 *         description: Job deleted successfully
 *       404:
 *         description: Job not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", async (req, res) => {
  try {
    const job = await crawlQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    await job.remove();
    res.json({ success: true, message: "Job deleted successfully" });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     summary: Get a specific job by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The job ID
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *       500:
 *         description: Server error
 */
router.get("/:id", async (req, res) => {
  try {
    const job = await crawlQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const state = await job.getState();
    const result = job.returnvalue;

    res.json({
      success: true,
      data: {
        id: job.id,
        status: state,
        result,
        finishedOn: job.finishedOn,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /jobs/clean:
 *   post:
 *     summary: Clear all jobs from the queue
 *     tags: [Jobs]
 *     responses:
 *       200:
 *         description: Queue cleared successfully
 *       500:
 *         description: Server error
 */
router.post("/clean", async (req, res) => {
  try {
    // "obliterate" completely destroys the queue, removing all jobs and locks.
    // { force: true } is required to remove active jobs.
    await crawlQueue.obliterate({ force: true });
    
    // Note: After obliterate, the queue structures are gone.
    // Bull should recreate them on next '.add()', but simple '.empty()' or '.clean()'
    // is safer if we just want to remove jobs.
    // However, for "stuck" active jobs that aren't in the active list, obliterate is the most reliable.
    
    res.json({ success: true, message: "Queue partially cleared. Please wait for scheduler to refill." });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
