-- Additive parity with the current SQLite backend. Never edit applied migrations.
CREATE TABLE shop_catalog_images (
  id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  import_id text NOT NULL REFERENCES shop_catalog_imports(id) ON DELETE CASCADE,
  extension text NOT NULL,
  byte_size bigint NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX shop_catalog_images_shop ON shop_catalog_images (shop_id);

CREATE TABLE render_history (
  id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  json text NOT NULL,
  image bytea NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX render_history_owner ON render_history (user_id, project_id, created_at DESC);

CREATE TABLE password_resets (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  used_at bigint
);
CREATE INDEX password_resets_user ON password_resets (user_id, expires_at);
