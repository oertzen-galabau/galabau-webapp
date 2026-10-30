-- Wichtige Beiträge: Anpinnen im Infodashboard (optional mit Ablaufdatum)

ALTER TABLE infoboard_posts
  ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;

ALTER TABLE infoboard_posts
  ADD COLUMN IF NOT EXISTS important_until timestamptz;

CREATE INDEX IF NOT EXISTS infoboard_posts_tenant_important_idx
  ON infoboard_posts (tenant_id, is_important)
  WHERE is_important = true;
