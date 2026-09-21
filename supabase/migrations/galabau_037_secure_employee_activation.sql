-- Secure employee activation:
-- - temporary passwords are verified as invitation secrets, never as Supabase Auth passwords
-- - users awaiting a password change cannot access tenant data through the direct API
-- - legacy invitations must be regenerated because they do not have a password hash

ALTER TABLE public.employee_invitations
  ADD COLUMN IF NOT EXISTS temp_password_hash text;

COMMENT ON COLUMN public.employee_invitations.temp_password_hash IS
  'Peppered SHA-256 hash of the one-time invitation password; never used as an Auth password.';

UPDATE public.employee_invitations
SET revoked_at = now()
WHERE temp_password_hash IS NULL
  AND used_at IS NULL
  AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.current_user_password_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT NOT p.must_change_password
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_password_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_password_ready() TO authenticated, service_role;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND c.relname <> 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS password_change_gate ON public.%I', target.relname);
    EXECUTE format(
      'CREATE POLICY password_change_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.current_user_password_ready()) WITH CHECK (public.current_user_password_ready())',
      target.relname
    );
  END LOOP;
END
$$;

DROP POLICY IF EXISTS password_change_gate_select ON public.profiles;
CREATE POLICY password_change_gate_select
  ON public.profiles
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.current_user_password_ready() OR id = auth.uid());

DROP POLICY IF EXISTS password_change_gate_insert ON public.profiles;
CREATE POLICY password_change_gate_insert
  ON public.profiles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_password_ready());

DROP POLICY IF EXISTS password_change_gate_update ON public.profiles;
CREATE POLICY password_change_gate_update
  ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.current_user_password_ready())
  WITH CHECK (public.current_user_password_ready());

DROP POLICY IF EXISTS password_change_gate_delete ON public.profiles;
CREATE POLICY password_change_gate_delete
  ON public.profiles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.current_user_password_ready());

COMMENT ON COLUMN public.tenants.default_start_password IS
  'Internal onboarding reference value; changing it never overwrites existing Auth passwords.';
