import { pool } from "./connection";

export async function addKeyword(keyword: string, url: string) {
  const result = await pool.query(
    "INSERT INTO keywords (keyword, url) VALUES ($1, $2) RETURNING *",
    [keyword, url],
  );
  return result.rows[0];
}

export async function getKeywords() {
  const result = await pool.query(
    "SELECT * FROM keywords ORDER BY created_at DESC",
  );
  return result.rows;
}

export async function saveRanking(keywordId: number, rank: number | null) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Record ranking
    await client.query(
      "INSERT INTO keyword_rankings (keyword_id, rank) VALUES ($1, $2)",
      [keywordId, rank],
    );

    // Update keyword status
    await client.query(
      "UPDATE keywords SET last_rank = $1, last_checked_at = NOW() WHERE id = $2",
      [rank, keywordId],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getRankings(keywordId: number) {
  const result = await pool.query(
    "SELECT * FROM keyword_rankings WHERE keyword_id = $1 ORDER BY checked_at DESC",
    [keywordId],
  );
  return result.rows;
}

export async function getAllRankings() {
  const result = await pool.query(`
    SELECT 
      r.id, r.rank, r.checked_at,
      k.keyword, k.url
    FROM keyword_rankings r
    JOIN keywords k ON r.keyword_id = k.id
    ORDER BY r.checked_at DESC
    LIMIT 1000
  `);
  return result.rows;
}
