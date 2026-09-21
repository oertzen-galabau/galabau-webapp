-- Infoboard-Beiträge (Neuigkeiten, Termine, Hinweise)
-- Idempotent: Tabelle existiert ggf. bereits in der Live-DB.

CREATE TABLE IF NOT EXISTS infoboard_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  post_type text NOT NULL DEFAULT 'news',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS infoboard_posts_tenant_published_idx
  ON infoboard_posts (tenant_id, published_at DESC);

ALTER TABLE infoboard_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_infoboard ON infoboard_posts;
CREATE POLICY tenant_isolation_infoboard ON infoboard_posts
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
