import { pool } from "../src/db/connection";

async function checkLatest() {
  const result = await pool.query(
    "SELECT * FROM keyword_rankings ORDER BY checked_at DESC LIMIT 5"
  );

  console.log("Latest 5 rankings:");
  result.rows.forEach(row => {
      console.log(`ID: ${row.id}, KeywordID: ${row.keyword_id}, Rank: ${row.rank}`);
      console.log(`  CreatedAt: ${row.crawling_created_at}`);
      console.log(`  Duration: ${row.crawling_duration}ms`);
      console.log(`  Total: ${row.total_duration}ms`);
      console.log(`  Method: ${row.crawling_method}`);
      console.log("-----------------------------------");
  });
  
  await pool.end();
}

checkLatest();
