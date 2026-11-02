-- Mitarbeitende dürfen eigene offene oder abgelehnte Anträge korrigieren (Server-Action setzt bei abgelehnt wieder auf pending).

DROP POLICY IF EXISTS leave_requests_update ON public.leave_requests;

CREATE POLICY leave_requests_update ON public.leave_requests
  FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.user_can_view_leave_for_approval()
      OR (
        user_id = auth.uid()
        AND status IN ('pending'::public.leave_status, 'rejected'::public.leave_status)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.user_can_view_leave_for_approval()
      OR (
        user_id = auth.uid()
        AND status IN ('pending'::public.leave_status, 'rejected'::public.leave_status)
      )
    )
  );
