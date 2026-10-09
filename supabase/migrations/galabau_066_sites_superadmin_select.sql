-- Superadmin: Baustellen des geöffneten Mandanten (current_tenant_id via x-tenant-slug) lesen

DROP POLICY IF EXISTS sites_select ON public.sites;

CREATE POLICY sites_select ON public.sites
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.assign_team'::text)
      OR responsible_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.site_team_members stm
        WHERE stm.site_id = sites.id AND stm.user_id = auth.uid()
      )
    )
  );
