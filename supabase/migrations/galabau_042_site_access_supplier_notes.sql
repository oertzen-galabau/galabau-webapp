-- Baustellen: Vorarbeiter-Zuordnung, Lieferanten-Bemerkung, restriktivere Sicht

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sites_tenant_responsible_idx
  ON sites (tenant_id, responsible_user_id)
  WHERE responsible_user_id IS NOT NULL;

ALTER TABLE site_suppliers
  ADD COLUMN IF NOT EXISTS notes text;

-- Sites SELECT: Mandant + (Verwaltung/Vorarbeiter mit Rechten ODER Einteilung ODER zuständiger VA)
DROP POLICY IF EXISTS tenant_isolation_sites ON sites;

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
    )
  );

CREATE POLICY sites_modify ON sites
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'sites.manage'
      )
    )
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'sites.manage'
      )
    )
  );
