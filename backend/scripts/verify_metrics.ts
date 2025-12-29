import { crawlQueue } from "../src/queue/crawlQueue";
import { pool } from "../src/db/connection";
import { startProcessor } from "../src/worker/processor";
import { Job } from "bull";

async function verify() {
  console.log("Starting verification...");

  // 1. Clear previous rankings for test keyword
  const testKeywordId = 9999;
  await pool.query("DELETE FROM keywords WHERE id = $1", [testKeywordId]);
  await pool.query(
    "INSERT INTO keywords (id, keyword, url) VALUES ($1, $2, $3)",
    [testKeywordId, "test_metrics", "example.com"]
  );

  // 2. Start Processor (in-process)
  startProcessor();

  // 3. Add Job
  console.log("Adding job...");
  const job = await crawlQueue.add({
    keywordId: testKeywordId,
    keyword: "test_metrics",
    targetUrl: "example.com",
    targetRank: 1
  });

  console.log(`Job added: ${job.id}`);

  // 4. Wait for completion
  return new Promise<void>((resolve, reject) => {
    job.finished().then(async () => {
      console.log("Job finished!");

      // 5. Check DB
      const result = await pool.query(
        "SELECT * FROM keyword_rankings WHERE keyword_id = $1 ORDER BY checked_at DESC LIMIT 1",
        [testKeywordId]
      );

      const row = result.rows[0];
      console.log("DB Result:", row);

      if (row.crawling_duration && row.total_duration && row.crawling_method) {
        console.log("SUCCESS: Metrics found!");
        console.log(`Duration: ${row.crawling_duration}ms`);
        console.log(`Total: ${row.total_duration}ms`);
        console.log(`Method: ${row.crawling_method}`);
      } else {
        console.error("FAILURE: Metrics missing!");
        process.exit(1);
      }

      // Check logs
      const logs = await crawlQueue.getJobLogs(job.id);
      console.log("Job Logs:", logs.logs);
      
      process.exit(0);
    }).catch(err => {
        console.error("Job failed", err);
        process.exit(1);
    });
  });
}

verify();
