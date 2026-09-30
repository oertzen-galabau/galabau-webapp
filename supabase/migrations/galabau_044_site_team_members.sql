-- Dauerhafte Baustellen-Team-Zuweisung (Vorarbeiter + Mitarbeiter)

CREATE TABLE IF NOT EXISTS site_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, user_id)
);

CREATE INDEX IF NOT EXISTS site_team_members_tenant_user_idx
  ON site_team_members (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS site_team_members_site_id_idx
  ON site_team_members (site_id);

ALTER TABLE site_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_team_members_select ON site_team_members
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM site_team_members stm
        WHERE stm.site_id = site_team_members.site_id
          AND stm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM sites s
        WHERE s.id = site_team_members.site_id
          AND s.responsible_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM daily_assignments da
        WHERE da.site_id = site_team_members.site_id
          AND da.user_id = auth.uid()
          AND da.assignment_date >= (timezone('Europe/Berlin', now()))::date
      )
    )
  );

CREATE POLICY site_team_members_insert ON site_team_members
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'sites.assign_team'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY site_team_members_delete ON site_team_members
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'sites.assign_team'
          AND trp.granted = true
      )
    )
  );

-- sites_select: Team-Zuweisung als weiterer Zugriffsweg
DROP POLICY IF EXISTS sites_select ON sites;

CREATE POLICY sites_select ON sites
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR responsible_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM daily_assignments da
        WHERE da.site_id = sites.id
          AND da.user_id = auth.uid()
          AND da.assignment_date >= (timezone('Europe/Berlin', now()))::date
      )
      OR EXISTS (
        SELECT 1 FROM site_team_members stm
        WHERE stm.site_id = sites.id
          AND stm.user_id = auth.uid()
      )
    )
  );

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'sites.assign_team', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
