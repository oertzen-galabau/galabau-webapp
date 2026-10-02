-- Baustellen-Sicht: nur Verwaltung/Administrator, Team-Zuweisung (sites.assign_team),
-- Verantwortlicher oder Eintrag in site_team_members — nicht mehr sites.view oder Tages-Einteilung.

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
      WHERE s.id = p_site_id AND s.responsible_user_id = auth.uid()
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
      OR EXISTS (
        SELECT 1 FROM site_team_members stm
        WHERE stm.site_id = sites.id
          AND stm.user_id = auth.uid()
      )
    )
  );
