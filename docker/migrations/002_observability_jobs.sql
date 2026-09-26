CREATE TABLE audit_log (id bigserial PRIMARY KEY, shop_id text REFERENCES shops(id) ON DELETE CASCADE, actor_id text, action text NOT NULL, entity_type text NOT NULL, entity_id text, detail_json text NOT NULL DEFAULT '{}', created_at bigint NOT NULL);
CREATE INDEX audit_log_shop_time ON audit_log (shop_id, created_at DESC);
CREATE TABLE api_metrics (id bigserial PRIMARY KEY, route text NOT NULL, method text NOT NULL, status integer NOT NULL, latency_ms integer NOT NULL, created_at bigint NOT NULL);
CREATE INDEX api_metrics_time ON api_metrics (created_at DESC);
CREATE TABLE error_log (id bigserial PRIMARY KEY, route text NOT NULL, message text NOT NULL, stack text, created_at bigint NOT NULL);
CREATE INDEX error_log_time ON error_log (created_at DESC);
CREATE TABLE jobs (id text PRIMARY KEY, kind text NOT NULL, payload_json text NOT NULL, state text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, run_after bigint NOT NULL, lease_until bigint, last_error text, created_at bigint NOT NULL);
CREATE INDEX jobs_ready ON jobs (state, run_after);
