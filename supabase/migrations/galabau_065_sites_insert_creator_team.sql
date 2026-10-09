-- Nach INSERT: Ersteller ins Baustellen-Team, damit INSERT … RETURNING (select id) unter RLS 052 funktioniert.

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

  IF public.has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
     OR public.has_tenant_permission('sites.assign_team')
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.site_team_members (tenant_id, site_id, user_id)
  VALUES (NEW.tenant_id, NEW.id, v_uid)
  ON CONFLICT (site_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sites_after_insert_grant_creator_access ON public.sites;

CREATE TRIGGER sites_after_insert_grant_creator_access
  AFTER INSERT ON public.sites
  FOR EACH ROW
  EXECUTE FUNCTION public.sites_after_insert_grant_creator_access();

REVOKE ALL ON FUNCTION public.sites_after_insert_grant_creator_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sites_after_insert_grant_creator_access() TO authenticated, service_role;
