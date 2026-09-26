ALTER TABLE jobs ADD COLUMN shop_id text REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN result_json text;
ALTER TABLE jobs ADD COLUMN lease_token text;
CREATE INDEX jobs_shop ON jobs (shop_id, created_at DESC);
