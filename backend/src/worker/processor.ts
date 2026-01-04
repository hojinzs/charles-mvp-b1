import { Job } from "bull";
import { crawlQueue } from "../queue/crawlQueue";
import { checkRanking } from "./crawler";
import {
  saveRanking,
  updateBulkSearchKeywordStatus,
  getBulkSearchById,
  updateBulkSearchCounts,
} from "../db/queries";
import { jobDurationHistogram, jobsCompletedCounter } from "../metrics";
import { pool } from "../db/connection";

interface CrawlJobData {
  keywordId?: number | null;
  bulkSearchKeywordId?: number | null;
  keyword: string;
  targetUrl: string;
  targetRank?: number;
}

export const startProcessor = () => {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "1");

  crawlQueue.process(concurrency, async (job: Job<CrawlJobData>) => {
    const { keywordId, bulkSearchKeywordId, keyword, targetUrl, targetRank } =
      job.data;

    const isBulkSearch = !!bulkSearchKeywordId;
    console.log(
      `[Worker ${process.pid}] Processing job ${job.id}: ${keyword} ${isBulkSearch ? "(Bulk Search)" : ""}`
    );

    try {
      const processingStartTime = Date.now();
      await job.log(
        `Processing started at ${new Date(processingStartTime).toISOString()}`
      );

      // Progress update
      await job.progress(10);

      // Execute Crawling
      const { rank, method, networkStats } = await checkRanking(
        keyword,
        targetUrl
      );

      const processingEndTime = Date.now();
      const crawlingDuration = processingEndTime - processingStartTime;
      const totalDuration = processingEndTime - job.timestamp;

      // Record Metrics
      jobDurationHistogram.observe(
        { phase: "processing" },
        crawlingDuration / 1000
      );
      jobDurationHistogram.observe({ phase: "total" }, totalDuration / 1000);

      await job.log(
        `Crawling completed. Method: ${method}, Rank: ${rank}, Duration: ${crawlingDuration}ms, Network: ${networkStats.totalSize}KB`
      );
      await job.progress(80);

      // Save Result to DB
      if (isBulkSearch && bulkSearchKeywordId) {
        // For bulk search: update bulk_search_keywords table
        await updateBulkSearchKeywordStatus(
          bulkSearchKeywordId,
          "completed",
          rank
        );

        // Update bulk_searches counts
        const result = await pool.query(
          `SELECT bulk_search_id FROM bulk_search_keywords WHERE id = $1`,
          [bulkSearchKeywordId]
        );

        if (result.rows.length > 0) {
          const bulkSearchId = result.rows[0].bulk_search_id;

          // Get current counts
          const countsResult = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE status = 'completed' OR status = 'cached') as completed,
               COUNT(*) FILTER (WHERE status = 'pending' OR status = 'processing') as pending
             FROM bulk_search_keywords
             WHERE bulk_search_id = $1`,
            [bulkSearchId]
          );

          const completed = parseInt(countsResult.rows[0].completed);
          const pending = parseInt(countsResult.rows[0].pending);

          await updateBulkSearchCounts(bulkSearchId, completed, pending);
        }

        // Also save to main keywords table if keywordId exists
        if (keywordId) {
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
        }
      } else if (keywordId) {
        // Normal keyword monitoring
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
      }

      jobsCompletedCounter.inc({ status: "success", method: method });

      await job.progress(100);

      console.log(
        `[Worker ${process.pid}] Job ${job.id} completed. Rank: ${rank}, Method: ${method}, Duration: ${crawlingDuration}ms`
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

      // Mark as failed for bulk search
      if (bulkSearchKeywordId) {
        try {
          await updateBulkSearchKeywordStatus(bulkSearchKeywordId, "failed");
        } catch (updateError) {
          console.error(
            `[Worker] Failed to update bulk search keyword status:`,
            updateError
          );
        }
      }

      throw e;
    }
  });

  console.log(
    `Worker started with concurrency: ${concurrency} (PID: ${process.pid})`,
  );
};
