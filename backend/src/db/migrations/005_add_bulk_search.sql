-- bulk_searches table
CREATE TABLE IF NOT EXISTS bulk_searches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  filename VARCHAR(255) NOT NULL,
  total_count INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'processing',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_searches_created ON bulk_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_searches_status ON bulk_searches(status);

-- bulk_search_keywords table
CREATE TABLE IF NOT EXISTS bulk_search_keywords (
  id SERIAL PRIMARY KEY,
  bulk_search_id INTEGER NOT NULL REFERENCES bulk_searches(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  rank INTEGER,
  cached_from TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_search_keywords_bulk_search ON bulk_search_keywords(bulk_search_id);
CREATE INDEX IF NOT EXISTS idx_bulk_search_keywords_status ON bulk_search_keywords(status);
CREATE INDEX IF NOT EXISTS idx_bulk_search_keywords_keyword_url ON bulk_search_keywords(keyword, url);
