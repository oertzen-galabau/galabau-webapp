-- Teamkalender: feinere RLS auf leave_requests + notizfreie Kalender-RPC

CREATE OR REPLACE FUNCTION public.user_can_view_leave_team_calendar()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superadmin()
    OR public.has_tenant_permission('urlaub.team_calendar');
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_leave_for_approval()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superadmin()
    OR public.has_tenant_permission('urlaub.approve')
    OR public.has_tenant_permission('urlaub.view_all');
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_team_member_leave()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superadmin()
    OR public.has_tenant_permission('team.view');
$$;

GRANT EXECUTE ON FUNCTION public.user_can_view_leave_team_calendar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_leave_for_approval() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_team_member_leave() TO authenticated;

DROP POLICY IF EXISTS tenant_isolation_leave_requests ON public.leave_requests;

CREATE POLICY leave_requests_select ON public.leave_requests
  FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.user_can_view_leave_for_approval()
      OR public.user_can_view_team_member_leave()
      OR (
        status = 'approved'::public.leave_status
        AND public.user_can_schedule_view()
      )
    )
  );

CREATE POLICY leave_requests_insert ON public.leave_requests
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY leave_requests_update ON public.leave_requests
  FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND public.user_can_view_leave_for_approval()
  )
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE OR REPLACE FUNCTION public.get_team_leave_calendar_entries(
  p_range_start date,
  p_range_end date
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  leave_type public.leave_type,
  start_date date,
  end_date date,
  status public.leave_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lr.id,
    lr.user_id,
    lr.leave_type,
    lr.start_date,
    lr.end_date,
    lr.status
  FROM public.leave_requests lr
  WHERE lr.tenant_id = public.current_tenant_id()
    AND lr.start_date <= p_range_end
    AND lr.end_date >= p_range_start
    AND (
      (
        lr.status = 'approved'::public.leave_status
        AND public.user_can_view_leave_team_calendar()
      )
      OR (
        lr.status = 'pending'::public.leave_status
        AND public.user_can_view_leave_for_approval()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_team_leave_calendar_entries(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_leave_calendar_entries(date, date) TO authenticated;

-- Matrix: Teamkalender für alle Standard-Mitarbeiterrollen
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'urlaub.team_calendar', true
FROM tenant_roles tr
WHERE tr.slug IN ('mitarbeiter', 'vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
