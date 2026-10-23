-- site_team_members: Superadmin + Mandanten-Rolle (slug) + has_tenant_permission (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.has_tenant_role(allowed user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.tenant_roles tr ON tr.id = p.tenant_role_id
    WHERE p.id = auth.uid()
      AND (
        p.role = ANY(allowed)
        OR tr.slug::text = ANY (SELECT unnest(allowed)::text)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.site_team_member_references_valid(
  p_tenant_id uuid,
  p_site_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = p_site_id AND s.tenant_id = p_tenant_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_user_id AND p.tenant_id = p_tenant_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.site_team_member_references_valid(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS site_team_members_insert ON public.site_team_members;
CREATE POLICY site_team_members_insert ON public.site_team_members
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.assign_team')
    )
    AND site_team_member_references_valid(tenant_id, site_id, user_id)
  );

DROP POLICY IF EXISTS site_team_members_delete ON public.site_team_members;
CREATE POLICY site_team_members_delete ON public.site_team_members
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.assign_team')
    )
  );
