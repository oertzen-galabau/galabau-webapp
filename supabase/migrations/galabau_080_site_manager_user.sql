-- Bauleiter pro Baustelle (Vorarbeiter bleibt sites.responsible_user_id)

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS site_manager_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sites_tenant_site_manager_idx
  ON sites (tenant_id, site_manager_user_id)
  WHERE site_manager_user_id IS NOT NULL;

COMMENT ON COLUMN sites.site_manager_user_id IS 'Bauleiter der Baustelle (Zugriff wie Team/Verantwortlicher).';

CREATE OR REPLACE FUNCTION public.user_can_view_site_team_on_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    public.is_superadmin()
    OR public.has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
    OR public.has_tenant_permission('sites.assign_team')
    OR EXISTS (
      SELECT 1 FROM public.site_team_members stm
      WHERE stm.site_id = p_site_id AND stm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = p_site_id
        AND (
          s.responsible_user_id = auth.uid()
          OR s.site_manager_user_id = auth.uid()
        )
    );
$$;

DROP POLICY IF EXISTS sites_select ON sites;

CREATE POLICY sites_select ON sites
  FOR SELECT
  USING (
    (tenant_id = current_tenant_id() OR is_superadmin())
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.assign_team')
      OR responsible_user_id = auth.uid()
      OR site_manager_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM site_team_members stm
        WHERE stm.site_id = sites.id
          AND stm.user_id = auth.uid()
      )
    )
  );
