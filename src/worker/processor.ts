import { Job } from "bull";
import { crawlQueue } from "../queue/crawlQueue";
import { checkRanking } from "./crawler";
import { saveRanking } from "../db/queries";

interface CrawlJobData {
  keywordId: number;
  keyword: string;
  targetUrl: string;
}

export const startProcessor = () => {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "1");

  crawlQueue.process(concurrency, async (job: Job<CrawlJobData>) => {
    const { keywordId, keyword, targetUrl } = job.data;

    console.log(`[Worker ${process.pid}] Processing job ${job.id}: ${keyword}`);

    try {
      // Progress update
      await job.progress(10);

      // Execute Crawling
      const rank = await checkRanking(keyword, targetUrl);

      await job.progress(80);

      // Save Result to DB
      await saveRanking(keywordId, rank);

      await job.progress(100);

      console.log(
        `[Worker ${process.pid}] Job ${job.id} completed. Rank: ${rank}`,
      );

      return { rank };
    } catch (e) {
      console.error(`[Worker ${process.pid}] Job ${job.id} failed:`, e);
      throw e;
    }
  });

  console.log(
    `Worker started with concurrency: ${concurrency} (PID: ${process.pid})`,
  );
};
