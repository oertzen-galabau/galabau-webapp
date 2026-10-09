'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { parseSegmentsFromForm } from '@/lib/time-tracking/form-parsing';
import { processTimeEntrySubmission } from '@/lib/time-tracking/submission';
import {
  deriveWorkDayState,
  todayWorkDate,
  toTimeString,
  type TimeEntryLike,
} from '@/lib/time-tracking/work-day';
import { countLeaveDays } from '@/lib/utils/time';
import {
  loadEntrySegments,
  saveEntrySegments,
  syncAutoBookingsForLeave,
  syncAutoBookingsForTimeEntry,
  type SegmentInput,
} from '@/lib/payroll/booking-service';
import {
  getBadWeatherSeasonFromConfig,
  leaveRuleKeyForType,
  loadTenantPayrollConfig,
  type BadWeatherConfig,
} from '@/lib/payroll/tenant-rules';
import { isBadWeatherSeason } from '@/lib/payroll/constants';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
  DEFAULT_SIDEBAR_COLOR,
  DEFAULT_SIDEBAR_TEXT_COLOR,
  DEFAULT_SURFACE_COLOR,
} from '@/lib/tenant/config';
import { deleteTenantLogo, uploadTenantLogo } from '@/lib/supabase/storage';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

function revalidateTimePaths() {
  revalidatePath('/app');
  revalidatePath('/app/zeiten');
  revalidatePath('/app/zeiten/freigabe');
  revalidatePath('/app/baustellen', 'layout');
}

async function getTodayEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  userId: string,
  workDate: string,
) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getOpenEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  userId: string,
  workDate: string,
) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .is('end_time', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function assertState(entry: TimeEntryLike | null, expected: ReturnType<typeof deriveWorkDayState>[]) {
  const state = deriveWorkDayState(entry);
  if (!expected.includes(state)) {
    throw new Error('Ungültiger Zeiterfassungsstatus für diese Aktion.');
  }
}

export async function clockInWork() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();

  const existing = await getTodayEntry(supabase, tenantId, userId, workDate);
  if (existing?.start_time) {
    throw new Error('Für heute existiert bereits ein Zeiteintrag.');
  }

  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('site_id')
    .eq('user_id', userId)
    .eq('assignment_date', workDate)
    .maybeSingle();

  const now = toTimeString(new Date());
  const { error } = await supabase.from('time_entries').insert({
    tenant_id: tenantId,
    user_id: userId,
    site_id: assignment?.site_id ?? null,
    work_date: workDate,
    start_time: now,
    end_time: null,
    travel_minutes: 0,
    work_minutes: 0,
  });
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function clockBreakfastStart() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const entry = await getOpenEntry(supabase, tenantId, userId, workDate);
  assertState(entry, ['working']);
  if (entry!.breakfast_start) throw new Error('Frühstückspause wurde bereits gestartet.');

  const { error } = await supabase
    .from('time_entries')
    .update({ breakfast_start: toTimeString(new Date()) })
    .eq('id', entry!.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function clockBreakfastEnd() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const entry = await getOpenEntry(supabase, tenantId, userId, workDate);
  assertState(entry, ['breakfast']);

  const { error } = await supabase
    .from('time_entries')
    .update({ breakfast_end: toTimeString(new Date()) })
    .eq('id', entry!.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function clockLunchStart() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const entry = await getOpenEntry(supabase, tenantId, userId, workDate);
  assertState(entry, ['working']);
  if (entry!.lunch_start) throw new Error('Mittagspause wurde bereits gestartet.');

  const { error } = await supabase
    .from('time_entries')
    .update({ lunch_start: toTimeString(new Date()) })
    .eq('id', entry!.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function clockLunchEnd() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const entry = await getOpenEntry(supabase, tenantId, userId, workDate);
  assertState(entry, ['lunch']);

  const { error } = await supabase
    .from('time_entries')
    .update({ lunch_end: toTimeString(new Date()) })
    .eq('id', entry!.id);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export type ClockOutPayload = {
  isDriver: boolean;
  segments: SegmentInput[];
  badWeatherClaimed?: boolean;
  missingBreakfastReason?: string | null;
  missingLunchReason?: string | null;
};

export async function clockOutWork(_legacyNoBreakReason?: string | null, payload?: ClockOutPayload) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const entry = await getOpenEntry(supabase, tenantId, userId, workDate);
  assertState(entry, ['working']);

  const endTime = toTimeString(new Date());
  const processed = await processTimeEntrySubmission(supabase, tenantId, {
    start_time: entry!.start_time!,
    end_time: endTime,
    breakfast_start: entry!.breakfast_start,
    breakfast_end: entry!.breakfast_end,
    lunch_start: entry!.lunch_start,
    lunch_end: entry!.lunch_end,
    missing_breakfast_reason: payload?.missingBreakfastReason,
    missing_lunch_reason: payload?.missingLunchReason,
    notes: entry!.notes,
    segments: payload?.segments ?? [],
  });

  const now = new Date().toISOString();
  const badWeatherClaimed = await sanitizeBadWeatherClaimed(
    supabase,
    tenantId,
    workDate,
    payload?.badWeatherClaimed ?? false,
  );
  const { error } = await supabase
    .from('time_entries')
    .update({
      end_time: processed.end_time,
      work_minutes: processed.work_minutes,
      travel_minutes: processed.travel_minutes,
      site_id: processed.site_id ?? entry!.site_id,
      breakfast_start: processed.breakfast_start,
      breakfast_end: processed.breakfast_end,
      lunch_start: processed.lunch_start,
      lunch_end: processed.lunch_end,
      missing_breakfast_reason: processed.missing_breakfast_reason,
      missing_lunch_reason: processed.missing_lunch_reason,
      is_driver: payload?.isDriver ?? false,
      bad_weather_claimed: badWeatherClaimed,
      bad_weather_confirmed: null,
      approval_status: 'pending',
      submitted_at: now,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq('id', entry!.id);
  if (error) throw new Error(error.message);

  if (processed.segments.length > 0) {
    await saveEntrySegments(supabase, tenantId, entry!.id, processed.segments);
  }

  revalidateTimePaths();
}

async function getOwnTimeEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  userId: string,
  entryId: string,
) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Eintrag nicht gefunden.');
  return data;
}

function assertOwnTimeEntryModifiable(
  entry: { approval_status: string | null; work_date: string; end_time: string | null },
  options: { requireCompleted?: boolean } = {},
) {
  if (entry.approval_status === 'approved') {
    throw new Error('Freigegebene Zeiteinträge können nicht mehr geändert werden.');
  }
  if (options.requireCompleted && !entry.end_time) {
    throw new Error('Laufende Zeiteinträge können hier nicht bearbeitet werden.');
  }
}

async function sanitizeBadWeatherClaimed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  workDate: string,
  claimed: boolean,
): Promise<boolean> {
  if (!claimed) return false;
  const config = await loadTenantPayrollConfig(supabase, tenantId);
  const cfg = config.rules.get('bad_weather')?.config as BadWeatherConfig | undefined;
  const { season_start, season_end } = getBadWeatherSeasonFromConfig(cfg);
  return isBadWeatherSeason(workDate, season_start, season_end);
}

function parseTimeEntryForm(formData: FormData) {
  const segments = parseSegmentsFromForm(formData);
  return {
    work_date: formData.get('work_date') as string,
    start_time: formData.get('start_time') as string,
    end_time: formData.get('end_time') as string,
    breakfast_start: (formData.get('breakfast_start') as string) || null,
    breakfast_end: (formData.get('breakfast_end') as string) || null,
    lunch_start: (formData.get('lunch_start') as string) || null,
    lunch_end: (formData.get('lunch_end') as string) || null,
    missing_breakfast_reason: (formData.get('missing_breakfast_reason') as string) || null,
    missing_lunch_reason: (formData.get('missing_lunch_reason') as string) || null,
    is_driver: formData.get('is_driver') === 'on' || formData.get('is_driver') === 'true',
    bad_weather_claimed: formData.get('bad_weather_claimed') === 'on',
    notes: (formData.get('notes') as string) || null,
    segments,
  };
}

export async function saveTimeEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const parsed = parseTimeEntryForm(formData);
  const { segments, ...entryFields } = parsed;
  entryFields.bad_weather_claimed = await sanitizeBadWeatherClaimed(
    supabase,
    tenantId,
    entryFields.work_date,
    entryFields.bad_weather_claimed,
  );

  const processed = await processTimeEntrySubmission(supabase, tenantId, {
    ...entryFields,
    segments,
  });
  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase.from('time_entries').insert({
    tenant_id: tenantId,
    user_id: userId,
    work_date: entryFields.work_date,
    start_time: processed.start_time,
    end_time: processed.end_time,
    breakfast_start: processed.breakfast_start,
    breakfast_end: processed.breakfast_end,
    lunch_start: processed.lunch_start,
    lunch_end: processed.lunch_end,
    missing_breakfast_reason: processed.missing_breakfast_reason,
    missing_lunch_reason: processed.missing_lunch_reason,
    travel_minutes: processed.travel_minutes,
    work_minutes: processed.work_minutes,
    site_id: processed.site_id,
    is_driver: entryFields.is_driver,
    bad_weather_claimed: entryFields.bad_weather_claimed,
    notes: entryFields.notes,
    approval_status: 'pending',
    submitted_at: now,
  }).select('id').single();
  if (error) throw new Error(error.message);

  if (processed.segments.length > 0 && inserted) {
    await saveEntrySegments(supabase, tenantId, inserted.id, processed.segments);
  }
  revalidateTimePaths();
}

export async function resubmitTimeEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const entryId = formData.get('id') as string;
  if (!entryId) throw new Error('Eintrag nicht gefunden.');

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();
  if (fetchError || !existing) throw new Error(fetchError?.message ?? 'Eintrag nicht gefunden.');
  if (existing.approval_status !== 'rejected') {
    throw new Error('Nur abgelehnte Einträge können erneut eingereicht werden.');
  }

  const parsed = parseTimeEntryForm(formData);
  const { segments, ...entryFields } = parsed;
  entryFields.bad_weather_claimed = await sanitizeBadWeatherClaimed(
    supabase,
    tenantId,
    entryFields.work_date,
    entryFields.bad_weather_claimed,
  );
  const processed = await processTimeEntrySubmission(supabase, tenantId, {
    ...entryFields,
    segments,
  });
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('time_entries')
    .update({
      work_date: entryFields.work_date,
      start_time: processed.start_time,
      end_time: processed.end_time,
      breakfast_start: processed.breakfast_start,
      breakfast_end: processed.breakfast_end,
      lunch_start: processed.lunch_start,
      lunch_end: processed.lunch_end,
      missing_breakfast_reason: processed.missing_breakfast_reason,
      missing_lunch_reason: processed.missing_lunch_reason,
      travel_minutes: processed.travel_minutes,
      work_minutes: processed.work_minutes,
      site_id: processed.site_id,
      is_driver: entryFields.is_driver,
      bad_weather_claimed: entryFields.bad_weather_claimed,
      notes: entryFields.notes,
      approval_status: 'pending',
      submitted_at: now,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      bad_weather_confirmed: null,
    })
    .eq('id', entryId);
  if (error) throw new Error(error.message);

  await saveEntrySegments(supabase, tenantId, entryId, processed.segments);
  revalidateTimePaths();
}

export async function approveTimeEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.approve');
  const { tenantId, userId } = ctx;

  const entryId = formData.get('id') as string;
  if (!entryId) throw new Error('Eintrag nicht gefunden.');

  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .single();
  if (fetchError || !entry) throw new Error(fetchError?.message ?? 'Eintrag nicht gefunden.');
  if (entry.approval_status !== 'pending') throw new Error('Nur offene Freigaben können genehmigt werden.');

  const badWeatherConfirmed = entry.bad_weather_claimed
    ? formData.get('bad_weather_confirmed') === 'on'
    : null;

  const { error } = await supabase
    .from('time_entries')
    .update({
      approval_status: 'approved',
      bad_weather_confirmed: badWeatherConfirmed,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', entryId);
  if (error) throw new Error(error.message);

  const segments = await loadEntrySegments(supabase, entryId);

  await syncAutoBookingsForTimeEntry(
    supabase,
    tenantId,
    entry.user_id,
    entryId,
    entry.work_date,
    { ...entry, bad_weather_confirmed: badWeatherConfirmed },
    segments,
  );

  revalidateTimePaths();
}

export async function rejectTimeEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.approve');
  const { tenantId, userId } = ctx;

  const entryId = formData.get('id') as string;
  const reason = (formData.get('reason') as string)?.trim();
  if (!entryId) throw new Error('Eintrag nicht gefunden.');
  if (!reason) throw new Error('Bitte einen Ablehnungsgrund angeben.');

  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from('time_entries')
    .select('id, approval_status')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .single();
  if (fetchError || !entry) throw new Error(fetchError?.message ?? 'Eintrag nicht gefunden.');
  if (entry.approval_status !== 'pending') throw new Error('Nur offene Freigaben können abgelehnt werden.');

  const { error } = await supabase
    .from('time_entries')
    .update({
      approval_status: 'rejected',
      rejection_reason: reason,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', entryId);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function updateTimeEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const entryId = formData.get('id') as string;
  if (!entryId) throw new Error('Eintrag nicht gefunden.');

  const supabase = await createClient();
  const existing = await getOwnTimeEntry(supabase, tenantId, userId, entryId);
  assertOwnTimeEntryModifiable(existing, { requireCompleted: true });

  const parsed = parseTimeEntryForm(formData);
  const { segments, ...entryFields } = parsed;

  entryFields.bad_weather_claimed = await sanitizeBadWeatherClaimed(
    supabase,
    tenantId,
    entryFields.work_date,
    entryFields.bad_weather_claimed,
  );
  const processed = await processTimeEntrySubmission(supabase, tenantId, {
    ...entryFields,
    segments,
  });
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('time_entries')
    .update({
      work_date: entryFields.work_date,
      start_time: processed.start_time,
      end_time: processed.end_time,
      breakfast_start: processed.breakfast_start,
      breakfast_end: processed.breakfast_end,
      lunch_start: processed.lunch_start,
      lunch_end: processed.lunch_end,
      missing_breakfast_reason: processed.missing_breakfast_reason,
      missing_lunch_reason: processed.missing_lunch_reason,
      travel_minutes: processed.travel_minutes,
      work_minutes: processed.work_minutes,
      site_id: processed.site_id,
      is_driver: entryFields.is_driver,
      bad_weather_claimed: entryFields.bad_weather_claimed,
      notes: entryFields.notes,
      approval_status: 'pending',
      submitted_at: now,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      bad_weather_confirmed: null,
    })
    .eq('id', entryId);
  if (error) throw new Error(error.message);

  await saveEntrySegments(supabase, tenantId, entryId, processed.segments);
  revalidateTimePaths();
}

export async function deleteTimeEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const entryId = formData.get('id') as string;
  if (!entryId) throw new Error('Eintrag nicht gefunden.');

  const supabase = await createClient();
  const existing = await getOwnTimeEntry(supabase, tenantId, userId, entryId);
  assertOwnTimeEntryModifiable(existing);

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', entryId);
  if (error) throw new Error(error.message);
  revalidateTimePaths();
}

export async function saveLeaveRequest(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'urlaub.request');
  const { tenantId, userId } = ctx;

  const leaveType = formData.get('leave_type') as string;
  let notes: string | null = (formData.get('notes') as string)?.trim() || null;

  if (leaveType === 'sonstige') {
    const reason = (formData.get('reason') as string)?.trim();
    if (!reason) throw new Error('Grund ist erforderlich.');
    notes = reason;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('leave_requests').insert({
    tenant_id: tenantId,
    user_id: userId,
    leave_type: leaveType,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
    notes,
  });
  if (error) throw new Error(error.message);

  const startDate = formData.get('start_date') as string;
  const endDate = formData.get('end_date') as string;
  const { formatLeaveType } = await import('@/lib/leave/labels');
  const { listLeaveApproverUserIds } = await import('@/lib/messages/leave-approver-recipients');
  const { insertDirectMessageTrusted } = await import('@/lib/messages/status-notify');
  const { displayName } = await import('@/lib/auth/roles');
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', userId)
    .single();
  const typeLabel = formatLeaveType(leaveType, notes);
  const range = `${startDate} – ${endDate}`;
  const notifyBody = `Neuer Antrag von ${displayName(senderProfile ?? { first_name: '', last_name: '', email: '' })}: ${typeLabel}, ${range}.`;

  try {
    const approverIds = await listLeaveApproverUserIds(supabase, tenantId, userId);
    await Promise.all(
      approverIds.map((recipientId) =>
        insertDirectMessageTrusted({
          tenantId,
          senderId: userId,
          recipientId,
          body: notifyBody,
        }),
      ),
    );
  } catch (notifyErr) {
    console.error('[leave] notify approvers on new request failed', notifyErr);
  }

  revalidatePath('/app');
  revalidatePath('/app/urlaub');
  revalidatePath('/app/nachrichten');
}

export async function updateLeaveStatus(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'urlaub.approve');
  const { userId, tenantId } = ctx;

  const supabase = await createClient();
  const requestId = formData.get('id') as string;
  const status = formData.get('status') as string;

  const { data: request, error: fetchError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .single();
  if (fetchError || !request) throw new Error(fetchError?.message ?? 'Antrag nicht gefunden');

  const { error } = await supabase.from('leave_requests').update({
    status,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  if (request.user_id !== userId) {
    const { insertDirectMessageWithFallback } = await import('@/lib/messages/status-notify');
    const { formatLeaveType } = await import('@/lib/leave/labels');
    const typeLabel = formatLeaveType(request.leave_type, request.notes);
    const statusLabel = status === 'approved' ? 'genehmigt' : 'abgelehnt';
    const range = `${request.start_date} – ${request.end_date}`;
    try {
      await insertDirectMessageWithFallback(supabase, {
        tenantId: request.tenant_id,
        senderId: userId,
        recipientId: request.user_id,
        body: `Dein Antrag (${typeLabel}, ${range}) wurde ${statusLabel}.`,
      });
    } catch (notifyErr) {
      console.error('[leave] notify employee on status change failed', notifyErr);
    }
  }

  if (status === 'approved' && leaveRuleKeyForType(request.leave_type)) {
    await syncAutoBookingsForLeave(
      supabase,
      request.tenant_id,
      request.user_id,
      requestId,
      request.leave_type,
      request.start_date,
      request.end_date,
    );
  }

  if (status === 'approved' && request.leave_type === 'urlaub') {
    const year = new Date(request.start_date).getFullYear();

    const [{ data: holidays }, { data: balance }] = await Promise.all([
      supabase.from('company_holidays').select('start_date, end_date').eq('tenant_id', request.tenant_id),
      supabase
        .from('leave_balances')
        .select('*')
        .eq('tenant_id', request.tenant_id)
        .eq('user_id', request.user_id)
        .eq('year', year)
        .maybeSingle(),
    ]);

    const days = countLeaveDays(request.start_date, request.end_date, holidays ?? []);
    const usedDays = (balance?.used_days ?? 0) + days;

    await supabase.from('leave_balances').upsert({
      tenant_id: request.tenant_id,
      user_id: request.user_id,
      year,
      entitlement_days: balance?.entitlement_days ?? 30,
      carried_over_days: balance?.carried_over_days ?? 0,
      used_days: usedDays,
    }, { onConflict: 'tenant_id,user_id,year' });
  }

  revalidatePath('/app');
  revalidatePath('/app/urlaub');
  revalidatePath('/app/urlaub/freigabe');
  revalidatePath('/app/nachrichten');
}

export async function sendChatMessage(recipientId: string, body: string) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'messages.send');
  const { tenantId, userId } = ctx;

  const trimmed = body.trim();
  if (!trimmed) throw new Error('Nachricht darf nicht leer sein.');
  if (recipientId === userId) throw new Error('Du kannst dir selbst keine Nachricht senden.');

  const supabase = await createClient();
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle();
  const messageTenantId = senderProfile?.tenant_id ?? tenantId;

  const { data: recipient } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', recipientId)
    .eq('tenant_id', messageTenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!recipient) throw new Error('Empfänger nicht gefunden.');

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      tenant_id: messageTenantId,
      sender_id: userId,
      recipient_id: recipientId,
      body: trimmed,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  revalidatePath('/app/nachrichten');
  revalidatePath(`/app/nachrichten/${recipientId}`);

  return message;
}

export async function markConversationRead(otherUserId: string) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'messages.send');
  const { userId } = ctx;

  const supabase = await createClient();
  const { markIncomingMessagesRead } = await import('@/lib/messages/read-state');
  const errorMessage = await markIncomingMessagesRead(supabase, {
    recipientUserId: userId,
    senderUserId: otherUserId,
  });
  if (errorMessage) throw new Error(errorMessage);

  revalidatePath('/app/nachrichten');
  revalidatePath(`/app/nachrichten/${otherUserId}`);
}

export async function markInboxDelivered() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'messages.send');
  const { userId } = ctx;

  const supabase = await createClient();
  const { markInboxDeliveredForUser } = await import('@/lib/messages/read-state');
  const errorMessage = await markInboxDeliveredForUser(supabase, userId);
  if (errorMessage) throw new Error(errorMessage);
}

export async function getUnreadMessageCount(): Promise<number> {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'nav.nachrichten')) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', ctx.userId)
    .is('read_at', null);
  if (error) throw new Error(error.message);

  return count ?? 0;
}

export async function getUnreadInboxSummaries() {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'nav.nachrichten')) return [];

  const { buildUnreadInboxSummaries } = await import('@/lib/messages/unread-inbox');
  const supabase = await createClient();
  const { data: messages, error } = await supabase
    .from('messages')
    .select('sender_id, body, created_at')
    .eq('recipient_id', ctx.userId)
    .is('read_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!messages?.length) return [];

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', senderIds);
  if (profileError) throw new Error(profileError.message);

  return buildUnreadInboxSummaries(messages, profiles ?? []);
}

export async function markConversationUnread(otherUserId: string) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'messages.send');
  const { userId } = ctx;

  const supabase = await createClient();
  const { data: lastRead, error: selectError } = await supabase
    .from('messages')
    .select('id')
    .eq('sender_id', otherUserId)
    .eq('recipient_id', userId)
    .not('read_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selectError) throw new Error(selectError.message);
  if (!lastRead) return;

  const { error } = await supabase
    .from('messages')
    .update({ read_at: null })
    .eq('id', lastRead.id);
  if (error) throw new Error(error.message);

  revalidatePath('/app/nachrichten');
  revalidatePath(`/app/nachrichten/${otherUserId}`);
}

export async function updateTenantBranding(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.branding');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('logo_url')
    .eq('id', tenantId)
    .single();

  let logoUrl = tenant?.logo_url ?? null;
  const logoFile = formData.get('logo');
  if (logoFile instanceof File && logoFile.size > 0) {
    await deleteTenantLogo(tenantId, logoUrl);
    const uploaded = await uploadTenantLogo(tenantId, logoFile);
    logoUrl = uploaded.publicUrl;
  }

  const { error } = await supabase.from('tenants').update({
    name: formData.get('name') as string,
    brand_color: (formData.get('brand_color') as string) || DEFAULT_BRAND_COLOR,
    accent_color: (formData.get('accent_color') as string) || DEFAULT_ACCENT_COLOR,
    sidebar_color: (formData.get('sidebar_color') as string) || DEFAULT_SIDEBAR_COLOR,
    sidebar_text_color: (formData.get('sidebar_text_color') as string) || DEFAULT_SIDEBAR_TEXT_COLOR,
    surface_color: (formData.get('surface_color') as string) || DEFAULT_SURFACE_COLOR,
    logo_url: logoUrl,
  }).eq('id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app', 'layout');
}

export async function removeTenantLogo() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.branding');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('logo_url')
    .eq('id', tenantId)
    .single();

  await deleteTenantLogo(tenantId, tenant?.logo_url ?? null);

  const { error } = await supabase
    .from('tenants')
    .update({ logo_url: null })
    .eq('id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app', 'layout');
}
