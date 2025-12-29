-- Add crawling metrics columns to keyword_rankings
ALTER TABLE keyword_rankings
ADD COLUMN IF NOT EXISTS crawling_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS crawling_duration INTEGER,
ADD COLUMN IF NOT EXISTS total_duration INTEGER,
ADD COLUMN IF NOT EXISTS crawling_method VARCHAR(50);

-- Update index to include new columns if analyzing performance is needed later
-- For now, existing index on (keyword_id, checked_at) is sufficient for retrieval
