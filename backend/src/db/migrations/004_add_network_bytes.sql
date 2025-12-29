-- Add network size tracking columns to keyword_rankings table
ALTER TABLE keyword_rankings
ADD COLUMN IF NOT EXISTS request_bytes INTEGER,
ADD COLUMN IF NOT EXISTS response_bytes INTEGER,
ADD COLUMN IF NOT EXISTS total_network_bytes INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN keyword_rankings.request_bytes IS 'Size of HTTP request in bytes (headers + body)';
COMMENT ON COLUMN keyword_rankings.response_bytes IS 'Size of HTTP response in bytes (headers + body)';
COMMENT ON COLUMN keyword_rankings.total_network_bytes IS 'Total network bytes transferred (request + response)';
