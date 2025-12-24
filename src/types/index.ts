export interface Keyword {
  id: number;
  keyword: string;
  url: string;
  last_rank: number | null;
  last_checked_at: Date | null;
  created_at: Date;
}

export interface KeywordRanking {
  id: number;
  keyword_id: number;
  rank: number;
  checked_at: Date;
}

export interface JobData {
  keywordId: number;
  keyword: string;
  targetUrl: string;
}
