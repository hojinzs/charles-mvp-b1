import { Router } from "express";
import { addKeyword, getKeywords } from "../../db/queries";

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
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the keyword was added
 *       example:
 *         id: 1
 *         keyword: "naver ads"
 *         url: "https://www.naver.com"
 *         createdAt: "2023-12-24T10:00:00.000Z"
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
 *               $ref: '#/components/schemas/Keyword'
 *       400:
 *         description: Missing keyword or url
 *       500:
 *         description: Server error
 */
router.post("/", async (req, res) => {
  try {
    const { keyword, url } = req.body;
    if (!keyword || !url) {
      return res
        .status(400)
        .json({ success: false, error: "Missing keyword or url" });
    }
    const result = await addKeyword(keyword, url);
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
 *     responses:
 *       200:
 *         description: The list of the keywords and total count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keywords:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Keyword'
 *                 total:
 *                   type: integer
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

    // TODO: Import specific type if extracting this to a separate file or use type assertion
    const result = await import("../../db/queries").then(m => m.getKeywordsPaginated({
      page,
      limit,
      sortBy,
      order,
      search,
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

export default router;
