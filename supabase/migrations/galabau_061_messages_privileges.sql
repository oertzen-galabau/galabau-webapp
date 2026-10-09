-- Messages absichern; Anon-Rechte entziehen; SECURITY DEFINER Funktionen härten

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  );

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND recipient_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND recipient_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.messages_guard_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_service_role_jwt() THEN
    RETURN NEW;
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'message fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_guard_immutable_fields ON public.messages;
CREATE TRIGGER messages_guard_immutable_fields
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_guard_immutable_fields();

REVOKE EXECUTE ON FUNCTION public.can_insert_direct_message(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_password_ready() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_tenant_permission(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(public.user_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_view_site_team_on_site(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_insert_direct_message(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_password_ready() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_site_team_on_site(uuid) TO authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
