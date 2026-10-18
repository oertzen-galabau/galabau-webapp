import type { SupabaseClient } from '@supabase/supabase-js';
import { daysInMonth, monthFirstDay, monthLastDay, normalizeMonthParam } from '@/lib/leave/calendar-month';
import type { LeaveCalendarRequest } from '@/lib/leave/calendar-layout';
import type { Profile, TenantWorkArea } from '@/lib/types/database';

export type TeamLeaveCalendarData = {
  month: string;
  monthDays: string[];
  employees: Pick<
    Profile,
    'id' | 'first_name' | 'last_name' | 'job_title' | 'work_area_id' | 'is_active'
  >[];
  workAreas: Pick<TenantWorkArea, 'id' | 'name' | 'sort_order' | 'is_active'>[];
  requests: LeaveCalendarRequest[];
  companyHolidays: { id: string; title: string; start_date: string; end_date: string }[];
  bridgeDays: { id: string; title: string; date: string }[];
};

export async function loadTeamLeaveCalendarData(
  supabase: SupabaseClient,
  tenantId: string,
  monthParam: string | undefined | null,
): Promise<TeamLeaveCalendarData> {
  const month = normalizeMonthParam(monthParam);
  const rangeStart = monthFirstDay(month);
  const rangeEnd = monthLastDay(month);
  const monthDays = daysInMonth(month);

  const [
    { data: employees, error: empError },
    { data: workAreas },
    { data: calendarRows, error: calError },
    { data: companyHolidays },
    { data: bridgeDays },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, job_title, work_area_id, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('last_name')
      .order('first_name'),
    supabase
      .from('tenant_work_areas')
      .select('id, name, sort_order, is_active')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('name'),
    supabase.rpc('get_team_leave_calendar_entries', {
      p_range_start: rangeStart,
      p_range_end: rangeEnd,
    }),
    supabase
      .from('company_holidays')
      .select('id, title, start_date, end_date')
      .eq('tenant_id', tenantId)
      .lte('start_date', rangeEnd)
      .gte('end_date', rangeStart),
    supabase
      .from('bridge_days')
      .select('id, title, date')
      .eq('tenant_id', tenantId)
      .gte('date', rangeStart)
      .lte('date', rangeEnd),
  ]);

  if (empError) {
    throw new Error(`Mitarbeiter konnten nicht geladen werden: ${empError.message}`);
  }
  if (calError) {
    throw new Error(`Abwesenheiten konnten nicht geladen werden: ${calError.message}`);
  }

  const requests = (calendarRows ?? []) as LeaveCalendarRequest[];

  return {
    month,
    monthDays,
    employees: employees ?? [],
    workAreas: workAreas ?? [],
    requests,
    companyHolidays: companyHolidays ?? [],
    bridgeDays: bridgeDays ?? [],
  };
}
