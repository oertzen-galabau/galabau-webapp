-- Profiles: Privilege-Eskalation verhindern (tenant_id, role, tenant_role_id)

CREATE OR REPLACE FUNCTION public.is_service_role_jwt()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('role', true), '')
  ) = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.profiles_guard_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_service_role_jwt() THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id cannot be changed';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NEW.role = 'superadmin'::public.user_role THEN
      RAISE EXCEPTION 'role superadmin not allowed via client';
    END IF;
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'cannot change own role';
    END IF;
    IF NOT (
      public.has_tenant_role(ARRAY['verwaltung'::public.user_role, 'administrator'::public.user_role])
      AND OLD.tenant_id = public.current_tenant_id()
    ) THEN
      RAISE EXCEPTION 'cannot change role';
    END IF;
  END IF;

  IF NEW.tenant_role_id IS DISTINCT FROM OLD.tenant_role_id THEN
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'cannot change own tenant_role_id';
    END IF;
    IF NOT (
      public.has_tenant_role(ARRAY['verwaltung'::public.user_role, 'administrator'::public.user_role])
      AND OLD.tenant_id = public.current_tenant_id()
    ) THEN
      RAISE EXCEPTION 'cannot change tenant_role_id';
    END IF;
    IF NEW.tenant_role_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.tenant_roles tr
      WHERE tr.id = NEW.tenant_role_id
        AND tr.tenant_id = OLD.tenant_id
    ) THEN
      RAISE EXCEPTION 'invalid tenant_role_id for tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_sensitive_columns ON public.profiles;
CREATE TRIGGER profiles_guard_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_sensitive_columns();

REVOKE UPDATE (tenant_id, role, tenant_role_id) ON public.profiles FROM authenticated;
REVOKE UPDATE (tenant_id, role, tenant_role_id) ON public.profiles FROM anon;
REVOKE INSERT (tenant_id, role, tenant_role_id) ON public.profiles FROM authenticated;
REVOKE INSERT (tenant_id, role, tenant_role_id) ON public.profiles FROM anon;

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT
  WITH CHECK (
    (
      is_superadmin()
      OR (
        tenant_id = current_tenant_id()
        AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      )
    )
    AND role IS DISTINCT FROM 'superadmin'::user_role
  );

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND tenant_id = current_tenant_id());

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE
  USING (
    is_superadmin()
    OR (
      tenant_id = current_tenant_id()
      AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
    )
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_superadmin()
  );
