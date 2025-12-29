import cron from "node-cron";
import { crawlQueue } from "../queue/crawlQueue";
import { getKeywordsToCrawl } from "../db/queries";
import { jobsScheduledCounter, queueSizeGauge } from "../metrics";

const SCHEDULER_INTERVAL_MS = parseInt(
  process.env.SCEDULER_INTERVAL_MS || "60000",
);
const SCHEDULER_CRON = process.env.SCHEDULER_CRON || "* * * * *";

export async function runScheduler() {
  console.log(`[Scheduler] Starting...`);
  console.log(`[Scheduler] Cron Pattern: "${SCHEDULER_CRON}"`);
  console.log(`[Scheduler] Interval Threshold: ${SCHEDULER_INTERVAL_MS}ms`);

  // Start Queue Monitoring
  setInterval(async () => {
    try {
      const counts = await crawlQueue.getJobCounts();
      queueSizeGauge.set({ status: "waiting" }, counts.waiting);
      queueSizeGauge.set({ status: "active" }, counts.active);
      queueSizeGauge.set({ status: "completed" }, counts.completed);
      queueSizeGauge.set({ status: "failed" }, counts.failed);
      queueSizeGauge.set({ status: "delayed" }, counts.delayed);
    } catch (e) {
      console.error("[Scheduler] Failed to update queue metrics:", e);
    }
  }, 5000);

  const run = async () => {
    try {
      console.log("[Scheduler] Checking for keywords...");
      const thresholdDate = new Date(Date.now() - SCHEDULER_INTERVAL_MS);
      console.log(
        `[Scheduler] Fetching keywords older than ${thresholdDate.toISOString()}...`,
      );

      const keywords = await getKeywordsToCrawl(thresholdDate);
      console.log(`[Scheduler] Found ${keywords.length} keywords to check.`);

      let enqueuedCount = 0;
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      for (const kw of keywords) {
        // Add a small delay to avoid Redis request spikes
        await sleep(30);

        // Deduplication check
        const existingJob = await crawlQueue.getJob(kw.id);
        let shouldEnqueue = !existingJob;

        if (existingJob) {
          const state = await existingJob.getState();
          if (state === "completed" || state === "failed") {
            shouldEnqueue = true;
          } else if (state === "stuck") {
            console.log(
              `[Scheduler] Removing stuck job ${kw.id} (${kw.keyword})`,
            );
            try {
              await existingJob.remove();
              // After removing, we can either enqueue immediately or wait for next tick
              shouldEnqueue = true;
            } catch (e) {
              console.error(
                `[Scheduler] Failed to remove stuck job ${kw.id}:`,
                e,
              );
            }
          } else {
            console.log(
              `[Scheduler] Skipping ${kw.keyword} (Job ${kw.id} exists, status: ${state})`,
            );
          }
        }

        if (shouldEnqueue) {
          console.log(`[Scheduler] Enqueuing ${kw.keyword}`);

          await crawlQueue.add(
            {
              keywordId: kw.id,
              keyword: kw.keyword,
              targetUrl: kw.url,
              targetRank: kw.target_rank,
            },
            {
              jobId: kw.id, // Use keyword ID as job ID for deduplication
              priority: 100, // Lower priority than manual requests
            },
          );
          enqueuedCount++;
          jobsScheduledCounter.inc();
        }
      }

      console.log(`[Scheduler] Enqueued ${enqueuedCount} jobs.`);
    } catch (e) {
      console.error("[Scheduler] Error:", e);
    }
  };

  // Initial run
  await run();

  // Cron Job
  cron.schedule(SCHEDULER_CRON, run);
}