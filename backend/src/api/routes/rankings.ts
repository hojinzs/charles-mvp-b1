import { Router } from "express";
import { getAllRankings, getRankings } from "../../db/queries";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Ranking:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the ranking entry
 *         rank:
 *           type: integer
 *           nullable: true
 *           description: The rank of the keyword (null if not found)
 *         checked_at:
 *           type: string
 *           format: date-time
 *           description: The timestamp of the check
 *         keyword:
 *           type: string
 *           description: The keyword (for getAllRankings)
 *         url:
 *           type: string
 *           description: The target URL (for getAllRankings)
 *         keyword_id:
 *           type: integer
 *           description: The associated keyword ID (for getRankings)
 */

/**
 * @swagger
 * tags:
 *   name: Rankings
 *   description: The rankings retrieval API
 */

/**
 * @swagger
 * /rankings:
 *   get:
 *     summary: Get all rankings (latest 1000)
 *     tags: [Rankings]
 *     responses:
 *       200:
 *         description: The list of rankings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ranking'
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  try {
    const rankings = await getAllRankings();
    res.json({ success: true, data: rankings });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * @swagger
 * /rankings/{keywordId}/rankings:
 *   get:
 *     summary: Get rankings for a specific keyword
 *     tags: [Rankings]
 *     parameters:
 *       - in: path
 *         name: keywordId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The keyword ID
 *     responses:
 *       200:
 *         description: The list of rankings for the keyword
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ranking'
 *       400:
 *         description: Invalid keyword ID
 *       500:
 *         description: Server error
 */
router.get("/:keywordId/rankings", async (req, res) => {
  try {
    const keywordId = parseInt(req.params.keywordId);
    if (isNaN(keywordId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid keyword ID" });
    }
    const rankings = await getRankings(keywordId);
    res.json({ success: true, data: rankings });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
