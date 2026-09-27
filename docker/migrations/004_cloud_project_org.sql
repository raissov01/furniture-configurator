CREATE TABLE cloud_project_org (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  json text NOT NULL,
  updated_at bigint NOT NULL
);
