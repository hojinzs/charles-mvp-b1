-- Add network size tracking columns to keyword_rankings table (in kilobytes)
ALTER TABLE keyword_rankings
ADD COLUMN IF NOT EXISTS request_kb INTEGER,
ADD COLUMN IF NOT EXISTS response_kb INTEGER,
ADD COLUMN IF NOT EXISTS total_network_kb INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN keyword_rankings.request_kb IS 'Size of HTTP request in kilobytes (headers + body)';
COMMENT ON COLUMN keyword_rankings.response_kb IS 'Size of HTTP response in kilobytes (headers + body)';
COMMENT ON COLUMN keyword_rankings.total_network_kb IS 'Total network kilobytes transferred (request + response)';
