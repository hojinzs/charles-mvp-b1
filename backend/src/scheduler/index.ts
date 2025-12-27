import dotenv from "dotenv";
import { crawlQueue } from "../queue/crawlQueue";
import { getKeywordsToCrawl } from "../db/queries";

dotenv.config();

const SCHEDULER_INTERVAL_MS = parseInt(process.env.SCEDULER_INTERVAL_MS || "60000");

async function runScheduler() {
  console.log(`[Scheduler] Starting... Interval: ${SCHEDULER_INTERVAL_MS}ms`);

  const run = async () => {
    try {
      console.log("[Scheduler] Checking for keywords...");
      const thresholdDate = new Date(Date.now() - SCHEDULER_INTERVAL_MS);
      console.log(`[Scheduler] Fetching keywords older than ${thresholdDate.toISOString()}...`);
      
      const keywords = await getKeywordsToCrawl(thresholdDate);
      console.log(`[Scheduler] Found ${keywords.length} keywords to check.`);

      let enqueuedCount = 0;

        for (const kw of keywords) {
            // Deduplication check
            const existingJob = await crawlQueue.getJob(kw.id);
            let shouldEnqueue = !existingJob;

            if (existingJob) {
                const state = await existingJob.getState();
                if (state === 'completed' || state === 'failed') {
                    shouldEnqueue = true;
                } else if (state === 'stuck') {
                    console.log(`[Scheduler] Removing stuck job ${kw.id} (${kw.keyword})`);
                    try {
                        await existingJob.remove();
                        // After removing, we can either enqueue immediately or wait for next tick
                        shouldEnqueue = true;
                    } catch (e) {
                         console.error(`[Scheduler] Failed to remove stuck job ${kw.id}:`, e);
                    }
                } else {
                    console.log(`[Scheduler] Skipping ${kw.keyword} (Job ${kw.id} exists, status: ${state})`);
                }
            }

            if (shouldEnqueue) {
                console.log(`[Scheduler] Enqueuing ${kw.keyword}`);
                
                 await crawlQueue.add({
                    keywordId: kw.id,
                    keyword: kw.keyword,
                    targetUrl: kw.url,
                  }, {
                      jobId: kw.id, // Use keyword ID as job ID for deduplication
                      priority: 100 // Lower priority than manual requests
                  });
                  enqueuedCount++;
            }
      }

      console.log(`[Scheduler] Enqueued ${enqueuedCount} jobs.`);
    } catch (e) {
      console.error("[Scheduler] Error:", e);
    }
  };

  // Initial run
  await run();

  // Interval loop
  setInterval(run, SCHEDULER_INTERVAL_MS);
}

runScheduler();
