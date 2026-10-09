-- Superadmin darf Baustellen im geöffneten Mandanten anlegen/bearbeiten.
-- Ersteller immer ins Baustellen-Team (RETURNING nach INSERT unter strikter SELECT-RLS).

CREATE OR REPLACE FUNCTION public.sites_after_insert_grant_creator_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.site_team_members (tenant_id, site_id, user_id)
  VALUES (NEW.tenant_id, NEW.id, v_uid)
  ON CONFLICT (site_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS sites_insert ON public.sites;
CREATE POLICY sites_insert ON public.sites
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage'::text)
    )
  );

DROP POLICY IF EXISTS sites_update ON public.sites;
CREATE POLICY sites_update ON public.sites
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage'::text)
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS sites_delete ON public.sites;
CREATE POLICY sites_delete ON public.sites
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage'::text)
    )
  );
