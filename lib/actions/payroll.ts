'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { PermissionKey } from '@/lib/auth/permissions';
import {
  loadCodeLabels,
  loadEntrySegments,
  saveEntrySegments,
  syncAutoBookingsForTimeEntry,
} from '@/lib/payroll/booking-service';
import {
  DEFAULT_RULE_CONFIGS,
  getBadWeatherSeasonFromConfig,
  loadTenantPayrollConfig,
  type BadWeatherConfig,
  type PayrollRuleKey,
} from '@/lib/payroll/tenant-rules';
import { formatBadWeatherSeasonLabel, isBadWeatherSeason } from '@/lib/payroll/constants';
import { buildDefaultTimeline, type TimelineBlockInput } from '@/lib/time-tracking/timeline';
import { loadTenantTimeTrackingRules } from '@/lib/time-tracking/break-rules';
import { fetchAccessibleSites } from '@/lib/sites/access';
import { todayWorkDate, toTimeString } from '@/lib/time-tracking/work-day';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

function revalidatePayrollPaths() {
  revalidatePath('/app/zeiten');
  revalidatePath('/app/zeiten/buchungen');
}

export async function getClockOutContext() {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'zeiten.record')) throw new Error('Keine Berechtigung');

  const supabase = await createClient();
  const workDate = todayWorkDate();

  const [sites, { data: assignment }, { data: todayEntry }, tenantConfig, timeRules] =
    await Promise.all([
    fetchAccessibleSites(supabase, ctx, 'id, name, default_travel_minutes'),
    supabase
      .from('daily_assignments')
      .select('site_id, sites(id, name, default_travel_minutes)')
      .eq('user_id', ctx.userId)
      .eq('assignment_date', workDate)
      .maybeSingle(),
    supabase
      .from('time_entries')
      .select('start_time, breakfast_start, breakfast_end, lunch_start, lunch_end')
      .eq('tenant_id', ctx.tenantId)
      .eq('user_id', ctx.userId)
      .eq('work_date', workDate)
      .is('end_time', null)
      .maybeSingle(),
    loadTenantPayrollConfig(supabase, ctx.tenantId),
    loadTenantTimeTrackingRules(supabase, ctx.tenantId),
  ]);

  const badWeatherCfg = tenantConfig.rules.get('bad_weather')?.config as BadWeatherConfig | undefined;
  const { season_start, season_end } = getBadWeatherSeasonFromConfig(badWeatherCfg);

  const assignedSiteRaw = assignment?.sites;
  const assignedSite = (Array.isArray(assignedSiteRaw) ? assignedSiteRaw[0] : assignedSiteRaw) as
    | { id: string; name: string; default_travel_minutes: number }
    | null
    | undefined;

  const endTime = toTimeString(new Date());
  const defaultTimeline: TimelineBlockInput[] = todayEntry?.start_time
    ? buildDefaultTimeline({
        startTime: todayEntry.start_time.slice(0, 5),
        endTime,
        breakfastStart: todayEntry.breakfast_start,
        breakfastEnd: todayEntry.breakfast_end,
        lunchStart: todayEntry.lunch_start,
        lunchEnd: todayEntry.lunch_end,
        defaultSiteId: assignedSite?.id ?? null,
      })
    : [];

  return {
    sites,
    defaultTimeline,
    assignedSiteId: assignedSite?.id ?? null,
    startTime: todayEntry?.start_time?.slice(0, 5) ?? null,
    endTime,
    timeRules,
    isBadWeatherSeason: isBadWeatherSeason(workDate, season_start, season_end),
    badWeatherSeasonLabel: formatBadWeatherSeasonLabel(season_start, season_end),
  };
}

export async function markBadWeatherDay(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.bad_weather.mark');

  const workDate = formData.get('work_date') as string;
  const siteId = (formData.get('site_id') as string) || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  if (!workDate) throw new Error('Datum fehlt.');

  const supabase = await createClient();
  const { error } = await supabase.from('bad_weather_days').upsert(
    {
      tenant_id: ctx.tenantId,
      work_date: workDate,
      site_id: siteId,
      marked_by: ctx.userId,
      notes,
    },
    { onConflict: 'tenant_id,work_date' },
  );
  if (error) throw new Error(error.message);
  revalidatePayrollPaths();
}

export async function unmarkBadWeatherDay(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.bad_weather.mark');

  const workDate = formData.get('work_date') as string;
  if (!workDate) throw new Error('Datum fehlt.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('bad_weather_days')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('work_date', workDate);
  if (error) throw new Error(error.message);
  revalidatePayrollPaths();
}

export async function saveManualBooking(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.bookings.edit');

  const bookingId = formData.get('id') as string | null;
  const timeEntryId = (formData.get('time_entry_id') as string) || null;
  const userId = formData.get('user_id') as string;
  const workDate = formData.get('work_date') as string;
  const bookingCode = formData.get('booking_code') as string;
  const quantity = Number(formData.get('quantity'));
  const unit = formData.get('unit') as 'hours' | 'eur';
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!userId || !workDate || !bookingCode || !unit || Number.isNaN(quantity)) {
    throw new Error('Pflichtfelder fehlen.');
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const row = {
    tenant_id: ctx.tenantId,
    user_id: userId,
    booking_code: bookingCode,
    quantity,
    unit,
    source: 'manual' as const,
    time_entry_id: timeEntryId,
    work_date: workDate,
    notes,
    updated_at: now,
  };

  if (bookingId) {
    const { error } = await supabase
      .from('payroll_bookings')
      .update(row)
      .eq('id', bookingId)
      .eq('tenant_id', ctx.tenantId)
      .eq('is_locked', false);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('payroll_bookings').insert(row);
    if (error) throw new Error(error.message);
  }

  revalidatePayrollPaths();
}

export async function deleteManualBooking(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.bookings.edit');

  const bookingId = formData.get('id') as string;
  if (!bookingId) throw new Error('Buchung nicht gefunden.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('payroll_bookings')
    .delete()
    .eq('id', bookingId)
    .eq('tenant_id', ctx.tenantId)
    .eq('source', 'manual')
    .eq('is_locked', false);
  if (error) throw new Error(error.message);
  revalidatePayrollPaths();
}

export async function regenerateBookingsForEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.bookings.edit');

  const entryId = formData.get('time_entry_id') as string;
  if (!entryId) throw new Error('Eintrag nicht gefunden.');

  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (error || !entry) throw new Error(error?.message ?? 'Eintrag nicht gefunden.');

  const segments = await loadEntrySegments(supabase, entryId);

  await syncAutoBookingsForTimeEntry(
    supabase,
    ctx.tenantId,
    entry.user_id,
    entryId,
    entry.work_date,
    entry,
    segments,
  );
  revalidatePayrollPaths();
}

export async function saveBookingCode(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.payroll_rules');

  const codeId = formData.get('id') as string | null;
  const code = (formData.get('code') as string)?.trim();
  const label = (formData.get('label') as string)?.trim();
  const unit = formData.get('unit') as 'hours' | 'eur';
  const isTaxFree = formData.get('is_tax_free') === 'on';

  if (!code || !label || !unit) throw new Error('Code, Bezeichnung und Einheit sind Pflicht.');

  const supabase = await createClient();
  const row = {
    tenant_id: ctx.tenantId,
    code,
    label,
    unit,
    is_tax_free: isTaxFree,
    is_active: true,
    is_system: false,
  };

  if (codeId) {
    const { error } = await supabase
      .from('payroll_booking_codes')
      .update(row)
      .eq('id', codeId)
      .eq('tenant_id', ctx.tenantId)
      .eq('is_system', false);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('payroll_booking_codes').insert(row);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/app/einstellungen');
}

export async function deactivateBookingCode(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.payroll_rules');

  const codeId = formData.get('id') as string;
  if (!codeId) throw new Error('Code nicht gefunden.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('payroll_booking_codes')
    .update({ is_active: false })
    .eq('id', codeId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_system', false);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
}

export async function saveTenantRule(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.payroll_rules');

  const ruleKey = formData.get('rule_key') as string;
  const enabled = formData.get('enabled') === 'on';
  if (!ruleKey) throw new Error('Regel fehlt.');

  const config: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('cfg_') && typeof value === 'string' && value.trim()) {
      const cfgKey = key.slice(4);
      const num = Number(value);
      config[cfgKey] = Number.isNaN(num) ? value.trim() : num;
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from('payroll_tenant_rules').upsert(
    {
      tenant_id: ctx.tenantId,
      rule_key: ruleKey,
      enabled,
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,rule_key' },
  );
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/zeiten');
}

export async function deactivateTenantRule(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.payroll_rules');

  const ruleKey = formData.get('rule_key') as PayrollRuleKey;
  if (!ruleKey) throw new Error('Regel fehlt.');

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('payroll_tenant_rules')
    .select('config')
    .eq('tenant_id', ctx.tenantId)
    .eq('rule_key', ruleKey)
    .maybeSingle();

  const { error } = await supabase.from('payroll_tenant_rules').upsert(
    {
      tenant_id: ctx.tenantId,
      rule_key: ruleKey,
      enabled: false,
      config: existing?.config ?? DEFAULT_RULE_CONFIGS[ruleKey],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,rule_key' },
  );
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/zeiten');
}

export { saveEntrySegments, loadCodeLabels };
