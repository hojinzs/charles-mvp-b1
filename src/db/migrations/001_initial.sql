-- keywords table
CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  last_rank INTEGER,
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keywords_created ON keywords(created_at DESC);

-- keyword_rankings table
CREATE TABLE IF NOT EXISTS keyword_rankings (
  id SERIAL PRIMARY KEY,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  rank INTEGER,
  checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rankings_keyword_checked ON keyword_rankings(keyword_id, checked_at DESC);
