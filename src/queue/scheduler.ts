import { crawlQueue } from "./crawlQueue";
import { getKeywords } from "../db/queries";

let schedulerInterval: NodeJS.Timeout | null = null;
let currentIntervalMs = 60000;

export function startScheduler(intervalMs: number = 60000) {
  if (schedulerInterval) {
    stopScheduler();
  }

  currentIntervalMs = intervalMs;

  schedulerInterval = setInterval(async () => {
    try {
      const keywords = await getKeywords();

      for (const kw of keywords) {
        await crawlQueue.add({
          keywordId: kw.id,
          keyword: kw.keyword,
          targetUrl: kw.url,
        });
      }

      console.log(`[Scheduler] Enqueued ${keywords.length} jobs`);
    } catch (e) {
      console.error("[Scheduler] Error enqueuing jobs:", e);
    }
  }, currentIntervalMs);

  console.log(`[Scheduler] Started with interval ${intervalMs}ms`);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped");
  }
}

export function getSchedulerState() {
  return {
    isRunning: schedulerInterval !== null,
    intervalMs: currentIntervalMs,
  };
}
