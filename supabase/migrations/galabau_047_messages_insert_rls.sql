-- Chat-Insert: Empfänger-Prüfung ohne false negatives durch profiles-RLS in der Policy-Subquery.
-- Superadmin (ohne profile.tenant_id) darf in den Mandanten schreiben, den die App übergibt.

CREATE OR REPLACE FUNCTION public.can_insert_direct_message(
  p_tenant_id uuid,
  p_recipient_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles sender
    WHERE sender.id = auth.uid()
      AND sender.is_active IS NOT FALSE
      AND (
        (sender.tenant_id IS NOT NULL AND sender.tenant_id = p_tenant_id)
        OR sender.role = 'superadmin'
      )
  )
  AND EXISTS (
    SELECT 1
    FROM profiles recipient
    WHERE recipient.id = p_recipient_id
      AND recipient.tenant_id = p_tenant_id
      AND recipient.is_active IS NOT FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.can_insert_direct_message(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_insert_direct_message(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS messages_insert ON messages;

CREATE POLICY messages_insert ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND can_insert_direct_message(tenant_id, recipient_id)
  );
