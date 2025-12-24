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
    const { keywordId, keyword, targetUrl } = req.body;

    // In a real app we might verify keywordId exists in DB first

    const job = await crawlQueue.add({
      keywordId,
      keyword,
      targetUrl,
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
      10,
    );

    res.json({
      success: true,
      data: {
        ...counts,
        jobs: jobs.map((j) => ({
          id: j.id,
          data: j.data,
          status: "unknown", // Need to fetch status individually if precise status per job is needed, or infer from list
          progress: j.progress(),
        })),
      },
    });
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

export default router;
