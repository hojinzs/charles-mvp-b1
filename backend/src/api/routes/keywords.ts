import { Router } from "express";
import { addKeyword, updateKeyword, deleteKeyword, findKeywordByKeywordAndUrl } from "../../db/queries";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Keyword:
 *       type: object
 *       required:
 *         - keyword
 *         - url
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the keyword
 *         keyword:
 *           type: string
 *           description: The keyword to monitor
 *         url:
 *           type: string
 *           description: The target URL
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: List of tags associated with the keyword
 *         targetRank:
 *           type: integer
 *           description: The desired rank for the keyword
 *         lastRank:
 *           type: integer
 *           nullable: true
 *           description: The last recorded rank
 *         lastCheckedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the keyword was last crawled
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the keyword was added
 *       example:
 *         id: 1
 *         keyword: "naver ads"
 *         url: "https://www.naver.com"
 *         tags: ["marketing", "ad"]
 *         targetRank: 5
 *         lastRank: 3
 *         lastCheckedAt: "2023-12-24T12:00:00.000Z"
 *         createdAt: "2023-12-24T10:00:00.000Z"
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *         error:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   name: Keywords
 *   description: The keywords managing API
 */

/**
 * @swagger
 * /keywords:
 *   post:
 *     summary: Create a new keyword
 *     tags: [Keywords]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyword
 *               - url
 *             properties:
 *               keyword:
 *                 type: string
 *               url:
 *                 type: string
 *             example:
 *               keyword: "example keyword"
 *               url: "http://example.com"
 *     responses:
 *       200:
 *         description: The created keyword.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Keyword'
 *       400:
 *         description: Missing keyword or url
 *       500:
 *         description: Server error
 */
router.post("/", async (req, res) => {
  try {
    const { keyword, url, tags, targetRank } = req.body;
    if (!keyword || !url) {
      return res
        .status(400)
        .json({ success: false, error: "Missing keyword or url" });
    }

    // 기존에 동일한 키워드와 URL이 있는지 확인
    const existing = await findKeywordByKeywordAndUrl(keyword, url);

    let result;
    if (existing) {
      // 기존 레코드가 있으면 업데이트
      result = await updateKeyword(existing.id, keyword, url, tags, targetRank);
    } else {
      // 없으면 새로 추가
      result = await addKeyword(keyword, url, tags, targetRank);
    }

    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /keywords/{id}:
 *   put:
 *     summary: Update an existing keyword
 *     tags: [Keywords]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Keyword ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyword
 *               - url
 *             properties:
 *               keyword:
 *                 type: string
 *               url:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetRank:
 *                 type: integer
 *     responses:
 *       200:
 *         description: The updated keyword
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Keyword'
 *       400:
 *         description: Missing param
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { keyword, url, tags, targetRank } = req.body;
    
    if (!keyword || !url) {
       return res.status(400).json({ success: false, error: "Missing keyword or url" });
    }

    const result = await updateKeyword(id, keyword, url, tags, targetRank);
    if (!result) {
      return res.status(404).json({ success: false, error: "Keyword not found" });
    }
    
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /keywords:
 *   get:
 *     summary: Returns the list of keywords with pagination, sorting, and filtering
 *     tags: [Keywords]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created, lastChecked, keyword, rank]
 *           default: created
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for keyword or url
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by a specific tag
 *     responses:
 *       200:
 *         description: The list of the keywords and total count
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
 *                     keywords:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Keyword'
 *                     total:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const sortBy = (req.query.sortBy as any) || 'created';
    const order = (req.query.order as any) || 'desc';
    const search = req.query.search as string | undefined;
    const tag = req.query.tag as string | undefined;

    // TODO: Import specific type if extracting this to a separate file or use type assertion
    const result = await import("../../db/queries").then(m => m.getKeywordsPaginated({
      page,
      limit,
      sortBy,
      order,
      search,
      tag,
    }));

    res.json({ 
      success: true, 
      data: {
        keywords: result.data,
        total: result.total
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /keywords/{id}:
 *   delete:
 *     summary: Delete a keyword
 *     tags: [Keywords]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Keyword ID
 *     responses:
 *       200:
 *         description: Keyword deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Keyword not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await deleteKeyword(id);
    if (!result) {
      return res.status(404).json({ success: false, error: "Keyword not found" });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
