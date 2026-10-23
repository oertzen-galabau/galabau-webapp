-- Gelesen-Status pro User für Infoboard-Beiträge

CREATE TABLE IF NOT EXISTS infoboard_post_reads (
  post_id uuid NOT NULL REFERENCES infoboard_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS infoboard_post_reads_user_tenant_idx
  ON infoboard_post_reads (user_id, tenant_id);

ALTER TABLE infoboard_post_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS infoboard_post_reads_self ON infoboard_post_reads;
CREATE POLICY infoboard_post_reads_self ON infoboard_post_reads
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND user_id = auth.uid()
  );

-- Bestehende Beiträge gelten als bereits gesehen (nur künftige ohne Eintrag = „Neu“)
INSERT INTO infoboard_post_reads (post_id, user_id, tenant_id, read_at)
SELECT p.id, pr.id, p.tenant_id, now()
FROM infoboard_posts p
JOIN profiles pr ON pr.tenant_id = p.tenant_id
ON CONFLICT (post_id, user_id) DO NOTHING;
