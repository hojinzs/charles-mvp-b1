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
 *     summary: Returns the list of all keywords
 *     tags: [Keywords]
 *     responses:
 *       200:
 *         description: The list of the keywords
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Keyword'
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  try {
    const keywords = await getKeywords();
    res.json({ success: true, data: keywords });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
