import type { SupabaseClient } from '@supabase/supabase-js';
import type { PayrollBookingSource } from '@/lib/types/database';
import {
  computeBookingPreview,
  computeLeaveBookingLines,
  computeNetWorkMinutes,
  type BookingRuleContext,
  type SegmentInput,
} from '@/lib/payroll/booking-rules';
import { isBadWeatherForBooking, isBadWeatherForPreview } from '@/lib/payroll/bad-weather-entry';
import { loadTenantPayrollConfig } from '@/lib/payroll/tenant-rules';
import { countLeaveDays } from '@/lib/utils/time';

export type { SegmentInput };

type Db = SupabaseClient;

export async function loadCodeLabels(supabase: Db, tenantId: string) {
  const config = await loadTenantPayrollConfig(supabase, tenantId);
  return config.codeLabels;
}

export async function loadSeasonConfig(supabase: Db, tenantId: string) {
  const { data } = await supabase
    .from('payroll_season_config')
    .select('*')
    .eq('tenant_id', tenantId);
  return data ?? [];
}

export async function getMonthBadWeatherHoursUsed(
  supabase: Db,
  tenantId: string,
  userId: string,
  workDate: string,
  badWeatherCode?: string,
) {
  if (!badWeatherCode) return 0;
  const month = workDate.slice(0, 7);
  const { data } = await supabase
    .from('payroll_bookings')
    .select('quantity')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('booking_code', badWeatherCode)
    .gte('work_date', `${month}-01`)
    .lte('work_date', `${month}-31`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.quantity), 0);
}

export async function isBadWeatherDay(supabase: Db, tenantId: string, workDate: string) {
  const { data } = await supabase
    .from('bad_weather_days')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('work_date', workDate)
    .maybeSingle();
  return !!data;
}

export async function loadEntrySegments(supabase: Db, timeEntryId: string): Promise<SegmentInput[]> {
  const { data } = await supabase
    .from('time_entry_segments')
    .select('site_id, travel_minutes')
    .eq('time_entry_id', timeEntryId)
    .order('sort_order');
  return (data ?? []).map((s) => ({
    site_id: s.site_id,
    travel_minutes: s.travel_minutes ?? 0,
  }));
}

export async function saveEntrySegments(
  supabase: Db,
  tenantId: string,
  timeEntryId: string,
  segments: SegmentInput[],
) {
  await supabase.from('time_entry_segments').delete().eq('time_entry_id', timeEntryId);
  if (segments.length === 0) return;

  const rows = segments.map((s, i) => ({
    tenant_id: tenantId,
    time_entry_id: timeEntryId,
    site_id: s.site_id,
    travel_minutes: s.travel_minutes,
    sort_order: i,
  }));
  const { error } = await supabase.from('time_entry_segments').insert(rows);
  if (error) throw new Error(error.message);
}

export async function buildBookingContext(
  supabase: Db,
  tenantId: string,
  userId: string,
  entry: BookingRuleContext['entry'] & {
    id?: string;
    bad_weather_claimed?: boolean;
    bad_weather_confirmed?: boolean | null;
  },
  segments: SegmentInput[],
  options?: { mode?: 'preview' | 'final' },
): Promise<BookingRuleContext> {
  const tenantConfig = await loadTenantPayrollConfig(supabase, tenantId);
  const badWeatherCode = tenantConfig.rules.get('bad_weather')?.config.code as string | undefined;
  const mode = options?.mode ?? 'preview';

  const [seasonConfig, tenantMarked, monthUsed, profileRes] = await Promise.all([
    loadSeasonConfig(supabase, tenantId),
    isBadWeatherDay(supabase, tenantId, entry.work_date),
    getMonthBadWeatherHoursUsed(supabase, tenantId, userId, entry.work_date, badWeatherCode),
    supabase.from('profiles').select('payroll_flags').eq('id', userId).single(),
  ]);

  const isBadWeather = mode === 'final'
    ? isBadWeatherForBooking(entry, tenantMarked)
    : isBadWeatherForPreview(entry, tenantMarked);

  const payrollFlags = (profileRes.data?.payroll_flags ?? {}) as BookingRuleContext['payrollFlags'];

  return {
    entry,
    segments,
    payrollFlags,
    isBadWeatherDay: isBadWeather,
    seasonConfig,
    monthBadWeatherHoursUsed: monthUsed,
    tenantConfig,
  };
}

export async function syncAutoBookingsForTimeEntry(
  supabase: Db,
  tenantId: string,
  userId: string,
  timeEntryId: string,
  workDate: string,
  entry: BookingRuleContext['entry'],
  segments: SegmentInput[],
) {
  const ctx = await buildBookingContext(supabase, tenantId, userId, entry, segments, { mode: 'final' });
  const { lines } = computeBookingPreview(ctx);

  await supabase
    .from('payroll_bookings')
    .delete()
    .eq('time_entry_id', timeEntryId)
    .eq('source', 'auto')
    .eq('is_locked', false);

  if (lines.length === 0) return;

  const now = new Date().toISOString();
  const rows = lines.map((line) => ({
    tenant_id: tenantId,
    user_id: userId,
    booking_code: line.booking_code,
    quantity: line.quantity,
    unit: line.unit,
    source: 'auto' as PayrollBookingSource,
    time_entry_id: timeEntryId,
    work_date: workDate,
    notes: line.notes ?? null,
    updated_at: now,
  }));

  const { error } = await supabase.from('payroll_bookings').insert(rows);
  if (error) throw new Error(error.message);
}

export async function syncAutoBookingsForLeave(
  supabase: Db,
  tenantId: string,
  userId: string,
  leaveRequestId: string,
  leaveType: string,
  startDate: string,
  endDate: string,
) {
  const tenantConfig = await loadTenantPayrollConfig(supabase, tenantId);
  const lines = computeLeaveBookingLines(leaveType, startDate, endDate, tenantConfig);

  await supabase
    .from('payroll_bookings')
    .delete()
    .eq('leave_request_id', leaveRequestId)
    .eq('source', 'auto');

  if (lines.length === 0) return;

  const now = new Date().toISOString();
  const rows = lines.map((line) => ({
    tenant_id: tenantId,
    user_id: userId,
    booking_code: line.booking_code,
    quantity: line.quantity,
    unit: line.unit,
    source: 'auto' as PayrollBookingSource,
    leave_request_id: leaveRequestId,
    work_date: line.notes ?? startDate,
    notes: line.notes ?? null,
    updated_at: now,
  }));

  const { error } = await supabase.from('payroll_bookings').insert(rows);
  if (error) throw new Error(error.message);
}

export function previewBookings(ctx: BookingRuleContext) {
  return computeBookingPreview(ctx);
}

export { computeNetWorkMinutes, countLeaveDays, loadTenantPayrollConfig };
