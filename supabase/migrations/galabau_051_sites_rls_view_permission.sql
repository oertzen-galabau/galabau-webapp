-- Baustellen-RLS: sites.view = alle Baustellen des Mandanten (wie vor 042 für Vorarbeiter),
-- Superadmin-Zugriff, Permission-Helper, site_team_members ohne RLS-Rekursion.

CREATE OR REPLACE FUNCTION public.has_tenant_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_role_permissions trp
    JOIN public.profiles p ON p.tenant_role_id = trp.tenant_role_id
    WHERE p.id = auth.uid()
      AND trp.permission_key = p_key
      AND trp.granted = true
  );
$$;

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
    OR public.has_tenant_permission('sites.view')
    OR EXISTS (
      SELECT 1 FROM public.site_team_members stm
      WHERE stm.site_id = p_site_id AND stm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = p_site_id AND s.responsible_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.daily_assignments da
      WHERE da.site_id = p_site_id
        AND da.user_id = auth.uid()
        AND da.assignment_date >= (timezone('Europe/Berlin', now()))::date
    );
$$;

DROP POLICY IF EXISTS site_team_members_select ON site_team_members;

CREATE POLICY site_team_members_select ON site_team_members
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      user_id = auth.uid()
      OR user_can_view_site_team_on_site(site_id)
    )
  );

DROP POLICY IF EXISTS sites_select ON sites;

CREATE POLICY sites_select ON sites
  FOR SELECT
  USING (
    (tenant_id = current_tenant_id() OR is_superadmin())
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.view')
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

DROP POLICY IF EXISTS sites_insert ON sites;

CREATE POLICY sites_insert ON sites
  FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id() OR is_superadmin())
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage')
    )
  );

DROP POLICY IF EXISTS sites_update ON sites;

CREATE POLICY sites_update ON sites
  FOR UPDATE
  USING (
    (tenant_id = current_tenant_id() OR is_superadmin())
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage')
    )
  )
  WITH CHECK (tenant_id = current_tenant_id() OR is_superadmin());

DROP POLICY IF EXISTS sites_delete ON sites;

CREATE POLICY sites_delete ON sites
  FOR DELETE
  USING (
    (tenant_id = current_tenant_id() OR is_superadmin())
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage')
    )
  );
