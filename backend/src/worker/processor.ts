import { Job } from "bull";
import { crawlQueue } from "../queue/crawlQueue";
import { checkRanking } from "./crawler";
import { saveRanking } from "../db/queries";
import { jobDurationHistogram, jobsCompletedCounter } from "../metrics";

interface CrawlJobData {
  keywordId: number;
  keyword: string;
  targetUrl: string;
  targetRank?: number;
}

export const startProcessor = () => {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "1");

  crawlQueue.process(concurrency, async (job: Job<CrawlJobData>) => {
    const { keywordId, keyword, targetUrl, targetRank } = job.data;

    console.log(`[Worker ${process.pid}] Processing job ${job.id}: ${keyword}`);

    try {
      const processingStartTime = Date.now();
      await job.log(`Processing started at ${new Date(processingStartTime).toISOString()}`);

      // Progress update
      await job.progress(10);

      // Execute Crawling
      const { rank, method, networkStats } = await checkRanking(keyword, targetUrl);

      const processingEndTime = Date.now();
      const crawlingDuration = processingEndTime - processingStartTime;
      const totalDuration = processingEndTime - job.timestamp; // job.timestamp is enqueue time

      // Record Metrics
      jobDurationHistogram.observe({ phase: "processing" }, crawlingDuration / 1000);
      jobDurationHistogram.observe({ phase: "total" }, totalDuration / 1000);
      jobsCompletedCounter.inc({ status: "success", method: method });

      await job.log(`Crawling completed. Method: ${method}, Rank: ${rank}, Duration: ${crawlingDuration}ms, Network: ${networkStats.totalSize}B`);
      await job.progress(80);

      // Save Result to DB
      await saveRanking(
        keywordId,
        rank,
        new Date(job.timestamp),
        crawlingDuration,
        totalDuration,
        method,
        networkStats.requestSize,
        networkStats.responseSize,
        networkStats.totalSize
      );

      await job.progress(100);

      console.log(
        `[Worker ${process.pid}] Job ${job.id} completed. Rank: ${rank}, Method: ${method}, Duration: ${crawlingDuration}ms`,
      );

      // Rate limiting delay
      const delay = parseInt(process.env.WORKER_INTERVAL_MS || "1000");
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      return { rank, targetRank, keyword };
    } catch (e) {
      jobsCompletedCounter.inc({ status: "failed", method: "unknown" });
      console.error(`[Worker ${process.pid}] Job ${job.id} failed:`, e);
      throw e;
    }
  });

  console.log(
    `Worker started with concurrency: ${concurrency} (PID: ${process.pid})`,
  );
};
