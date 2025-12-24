import { Router } from "express";
import {
  startScheduler,
  stopScheduler,
  getSchedulerState,
} from "../../queue/scheduler";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Scheduler
 *   description: The scheduler management API
 */

/**
 * @swagger
 * /scheduler/interval:
 *   post:
 *     summary: Set the scheduler check interval and start if not running
 *     tags: [Scheduler]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - intervalMs
 *             properties:
 *               intervalMs:
 *                 type: integer
 *                 description: Interval in milliseconds
 *                 example: 60000
 *     responses:
 *       200:
 *         description: Scheduler started/updated
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
 *                     intervalMs:
 *                       type: integer
 *       400:
 *         description: Invalid intervalMs
 */
router.post("/interval", (req, res) => {
  const { intervalMs } = req.body;
  if (!intervalMs || typeof intervalMs !== "number") {
    return res
      .status(400)
      .json({ success: false, error: "Invalid intervalMs" });
  }

  startScheduler(intervalMs);
  res.json({ success: true, data: { intervalMs } });
});

/**
 * @swagger
 * /scheduler/stop:
 *   post:
 *     summary: Stop the scheduler
 *     tags: [Scheduler]
 *     responses:
 *       200:
 *         description: Scheduler stopped
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
 *                     message:
 *                       type: string
 */
router.post("/stop", (req, res) => {
  stopScheduler();
  res.json({ success: true, data: { message: "Scheduler stopped" } });
});

/**
 * @swagger
 * /scheduler/state:
 *   get:
 *     summary: Get the current state of the scheduler
 *     tags: [Scheduler]
 *     responses:
 *       200:
 *         description: Scheduler state
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
 *                     isRunning:
 *                       type: boolean
 *                     intervalMs:
 *                       type: integer
 */
router.get("/state", (req, res) => {
  res.json({ success: true, data: getSchedulerState() });
});

export default router;
