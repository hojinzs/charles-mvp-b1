import { pool } from "./connection";

export async function addKeyword(
  keyword: string,
  url: string,
  tags: string[] = [],
  targetRank?: number,
) {
  const result = await pool.query(
    "INSERT INTO keywords (keyword, url, tags, target_rank) VALUES ($1, $2, $3, $4) RETURNING *",
    [keyword, url, tags, targetRank],
  );
  return result.rows[0];
}

export async function updateKeyword(
  id: number,
  keyword: string,
  url: string,
  tags: string[] = [],
  targetRank?: number,
) {
  const result = await pool.query(
    "UPDATE keywords SET keyword = $1, url = $2, tags = $3, target_rank = $4 WHERE id = $5 RETURNING *",
    [keyword, url, tags, targetRank, id],
  );
  return result.rows[0];
}

export async function getKeywords() {
  const result = await pool.query(
    "SELECT * FROM keywords ORDER BY created_at DESC",
  );
  return result.rows;
}

export async function getKeywordById(id: number) {
  const result = await pool.query("SELECT * FROM keywords WHERE id = $1", [id]);
  return result.rows[0];
}

export async function getKeywordsByIds(ids: number[]) {
  const result = await pool.query("SELECT * FROM keywords WHERE id = ANY($1)", [
    ids,
  ]);
  return result.rows;
}

export interface GetKeywordsOptions {
  page: number;
  limit: number;
  sortBy: "created" | "lastChecked" | "keyword" | "rank";
  order: "asc" | "desc";
  search?: string;
  tag?: string;
}

export async function getKeywordsPaginated({
  page,
  limit,
  sortBy,
  order,
  search,
  tag,
}: GetKeywordsOptions) {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(
      `(keyword ILIKE $${paramIndex} OR url ILIKE $${paramIndex})`,
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (tag) {
    conditions.push(`array_to_string(tags, ',') ILIKE $${paramIndex}`);
    params.push(`%${tag}%`);
    paramIndex++;
  }

  let orderByClause = "created_at DESC";
  const dir = order.toUpperCase();

  switch (sortBy) {
    case "lastChecked":
      orderByClause = `last_checked_at ${dir} NULLS LAST`;
      break;
    case "keyword":
      orderByClause = `keyword ${dir}`;
      break;
    case "rank":
      // For rank, NULLS LAST is usually desired to show ranked items first (if ASC) or last?
      // User said: "rank (null last)"
      orderByClause = `last_rank ${dir} NULLS LAST`;
      break;
    case "created":
    default:
      orderByClause = `created_at ${dir}`;
      break;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT *, count(*) OVER() as total_count 
    FROM keywords 
    ${whereClause} 
    ORDER BY ${orderByClause} 
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await pool.query(query, params);
  return {
    data: result.rows,
    total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
  };
}

export async function getKeywordsToCrawl(thresholdDate: Date) {
  const result = await pool.query(
    "SELECT * FROM keywords WHERE last_checked_at IS NULL OR last_checked_at <= $1 ORDER BY last_checked_at ASC NULLS FIRST",
    [thresholdDate],
  );
  return result.rows;
}

export async function saveRanking(
  keywordId: number,
  rank: number | null,
  crawlingCreatedAt?: Date,
  crawlingDuration?: number,
  totalDuration?: number,
  crawlingMethod?: string,
  requestKb?: number,
  responseKb?: number,
  totalNetworkKb?: number,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Record ranking with metrics
    await client.query(
      `INSERT INTO keyword_rankings
       (keyword_id, rank, crawling_created_at, crawling_duration, total_duration, crawling_method,
        request_kb, response_kb, total_network_kb)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        keywordId,
        rank,
        crawlingCreatedAt,
        crawlingDuration,
        totalDuration,
        crawlingMethod,
        requestKb,
        responseKb,
        totalNetworkKb,
      ],
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

export async function deleteKeyword(id: number) {
  const result = await pool.query(
    "DELETE FROM keywords WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rows[0];
}

/**
 * 키워드와 URL이 동일한 기존 레코드를 찾습니다.
 */
export async function findKeywordByKeywordAndUrl(keyword: string, url: string) {
  const result = await pool.query(
    "SELECT * FROM keywords WHERE keyword = $1 AND url = $2",
    [keyword, url]
  );
  return result.rows[0];
}
