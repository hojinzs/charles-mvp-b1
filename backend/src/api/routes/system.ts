import { Router } from "express";
import { crawlQueue } from "../../queue/crawlQueue";
import { resetSystemData } from "../../db/queries";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: System
 *   description: System administration APIs
 */

/**
 * @swagger
 * /system/reset:
 *   post:
 *     summary: Facotry reset the system (Clear all data)
 *     description: Removes all keywords, rankings, and clears the job queue.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post("/reset", async (req, res) => {
  try {
    console.log("[System] Requesting Factory Reset...");

    // 1. Clear Queue (Active jobs included)
    console.log("[System] Obliterating Queue...");
    try {
      await crawlQueue.pause(); // Pause processing
      await crawlQueue.obliterate({ force: true });
      console.log("[System] Queue obliterated.");
    } catch (qError) {
      console.error("[System] Error clearing queue (continuing):", qError);
      // Even if queue fails (e.g. redis issue), try to clear DB.
    }

    // 2. Clear Database
    console.log("[System] Truncating Database Tables...");
    await resetSystemData();
    console.log("[System] Database Reset Complete.");

    res.json({ 
      success: true, 
      message: "System has been reset. All data is cleared." 
    });

  } catch (e: any) {
    console.error("[System] Reset Failed:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
