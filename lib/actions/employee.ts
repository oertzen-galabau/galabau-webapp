'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { isWithinEditableDateRange } from '@/lib/time-tracking/entry-editable';
import {
  deriveWorkDayState,
  todayWorkDate,
  toTimeString,
  type TimeEntryLike,
} from '@/lib/time-tracking/work-day';
import { calculateWorkMinutes, countLeaveDays } from '@/lib/utils/time';
import {
  saveEntrySegments,
  syncAutoBookingsForLeave,
  syncAutoBookingsForTimeEntry,
  type SegmentInput,
} from '@/lib/payroll/booking-service';
import { leaveRuleKeyForType } from '@/lib/payroll/tenant-rules';
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
};

export async function clockOutWork(
  noBreakReason?: string | null,
  payload?: ClockOutPayload,
) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const entry = await getOpenEntry(supabase, tenantId, userId, workDate);
  assertState(entry, ['working']);

  const withoutBreak = !entry!.breakfast_start && !entry!.lunch_start;
  const reason = noBreakReason?.trim() ?? '';
  if (withoutBreak && !reason) {
    throw new Error('Bitte einen Grund angeben, warum heute keine Pause erfasst wurde.');
  }

  const segments = payload?.segments ?? [];
  const totalTravel = segments.reduce((sum, s) => sum + s.travel_minutes, 0);
  const endTime = toTimeString(new Date());
  const work_minutes = calculateWorkMinutes({
    start_time: entry!.start_time,
    end_time: endTime,
    breakfast_start: entry!.breakfast_start,
    breakfast_end: entry!.breakfast_end,
    lunch_start: entry!.lunch_start,
    lunch_end: entry!.lunch_end,
  });

  let notes = entry!.notes;
  if (withoutBreak) {
    const noteLine = `Ohne Pause: ${reason}`;
    notes = notes ? `${notes}\n${noteLine}` : noteLine;
  }

  const primarySiteId = segments[0]?.site_id ?? entry!.site_id;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('time_entries')
    .update({
      end_time: endTime,
      work_minutes,
      travel_minutes: totalTravel,
      site_id: primarySiteId,
      is_driver: payload?.isDriver ?? false,
      bad_weather_claimed: payload?.badWeatherClaimed ?? false,
      bad_weather_confirmed: null,
      notes,
      approval_status: 'pending',
      submitted_at: now,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq('id', entry!.id);
  if (error) throw new Error(error.message);

  if (segments.length > 0) {
    await saveEntrySegments(supabase, tenantId, entry!.id, segments);
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
  const today = todayWorkDate();
  if (!isWithinEditableDateRange(entry.work_date, today)) {
    throw new Error('Zeiteinträge können nur bis zu drei Tage zurück bearbeitet werden.');
  }
  if (options.requireCompleted && !entry.end_time) {
    throw new Error('Laufende Zeiteinträge können hier nicht bearbeitet werden.');
  }
}

function parseSegmentsFromForm(formData: FormData): SegmentInput[] {
  const siteIds = formData.getAll('segment_site_id[]');
  const travelMinutes = formData.getAll('segment_travel_minutes[]');
  const segments: SegmentInput[] = [];
  for (let i = 0; i < siteIds.length; i++) {
    const siteId = String(siteIds[i] ?? '').trim();
    if (!siteId) continue;
    segments.push({
      site_id: siteId,
      travel_minutes: Number(travelMinutes[i] ?? 0),
    });
  }
  return segments;
}

function parseTimeEntryForm(formData: FormData) {
  const segments = parseSegmentsFromForm(formData);
  const travelFromSegments = segments.reduce((sum, s) => sum + s.travel_minutes, 0);
  const legacyTravel = Number(formData.get('travel_minutes') ?? 0);
  return {
    site_id: segments[0]?.site_id ?? ((formData.get('site_id') as string) || null),
    work_date: formData.get('work_date') as string,
    start_time: formData.get('start_time') as string,
    end_time: formData.get('end_time') as string,
    breakfast_start: (formData.get('breakfast_start') as string) || null,
    breakfast_end: (formData.get('breakfast_end') as string) || null,
    lunch_start: (formData.get('lunch_start') as string) || null,
    lunch_end: (formData.get('lunch_end') as string) || null,
    travel_minutes: segments.length > 0 ? travelFromSegments : legacyTravel,
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
  const entry = {
    tenant_id: tenantId,
    user_id: userId,
    ...entryFields,
  };

  const work_minutes = calculateWorkMinutes(entry);
  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase.from('time_entries').insert({
    ...entry,
    work_minutes,
    approval_status: 'pending',
    submitted_at: now,
  }).select('id').single();
  if (error) throw new Error(error.message);

  if (segments.length > 0 && inserted) {
    await saveEntrySegments(supabase, tenantId, inserted.id, segments);
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
  const work_minutes = calculateWorkMinutes(entryFields);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('time_entries')
    .update({
      ...entryFields,
      work_minutes,
      approval_status: 'pending',
      submitted_at: now,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      bad_weather_confirmed: null,
    })
    .eq('id', entryId);
  if (error) throw new Error(error.message);

  await saveEntrySegments(supabase, tenantId, entryId, segments);
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

  const { data: segments } = await supabase
    .from('time_entry_segments')
    .select('site_id, travel_minutes')
    .eq('time_entry_id', entryId)
    .order('sort_order');

  await syncAutoBookingsForTimeEntry(
    supabase,
    tenantId,
    entry.user_id,
    entryId,
    entry.work_date,
    { ...entry, bad_weather_confirmed: badWeatherConfirmed },
    (segments ?? []).map((s) => ({ site_id: s.site_id, travel_minutes: s.travel_minutes })),
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
  const today = todayWorkDate();
  if (!isWithinEditableDateRange(entryFields.work_date, today)) {
    throw new Error('Das Datum muss innerhalb der letzten drei Tage liegen.');
  }

  const work_minutes = calculateWorkMinutes(entryFields);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('time_entries')
    .update({
      ...entryFields,
      work_minutes,
      approval_status: 'pending',
      submitted_at: now,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      bad_weather_confirmed: null,
    })
    .eq('id', entryId);
  if (error) throw new Error(error.message);

  await saveEntrySegments(supabase, tenantId, entryId, segments);
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
  revalidatePath('/app/urlaub');
}

export async function updateLeaveStatus(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'urlaub.approve');
  const { userId } = ctx;

  const supabase = await createClient();
  const requestId = formData.get('id') as string;
  const status = formData.get('status') as string;

  const { data: request, error: fetchError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  if (fetchError || !request) throw new Error(fetchError?.message ?? 'Antrag nicht gefunden');

  const { error } = await supabase.from('leave_requests').update({
    status,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId);
  if (error) throw new Error(error.message);

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

  revalidatePath('/app/urlaub');
}

export async function sendChatMessage(recipientId: string, body: string) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'messages.send');
  const { tenantId, userId } = ctx;

  const trimmed = body.trim();
  if (!trimmed) throw new Error('Nachricht darf nicht leer sein.');
  if (recipientId === userId) throw new Error('Du kannst dir selbst keine Nachricht senden.');

  const supabase = await createClient();
  const { data: recipient } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', recipientId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!recipient) throw new Error('Empfänger nicht gefunden.');

  const { error } = await supabase.from('messages').insert({
    tenant_id: tenantId,
    sender_id: userId,
    recipient_id: recipientId,
    body: trimmed,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/app/nachrichten');
  revalidatePath(`/app/nachrichten/${recipientId}`);
}

export async function markConversationRead(otherUserId: string) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'messages.send');
  const { userId } = ctx;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('messages')
    .update({ delivered_at: now, read_at: now })
    .eq('sender_id', otherUserId)
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw new Error(error.message);

  revalidatePath('/app/nachrichten');
  revalidatePath(`/app/nachrichten/${otherUserId}`);
}

export async function markInboxDelivered() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'messages.send');
  const { userId } = ctx;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('messages')
    .update({ delivered_at: now })
    .eq('recipient_id', userId)
    .is('delivered_at', null);
  if (error) throw new Error(error.message);
}

export async function saveClothingOrder(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.create');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const { error } = await supabase.from('clothing_orders').insert({
    tenant_id: tenantId,
    user_id: userId,
    item_type: formData.get('item_type') as string,
    size: formData.get('size') as string,
    quantity: Number(formData.get('quantity') ?? 1),
    notes: (formData.get('notes') as string) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app/bestellungen');
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
    await deleteTenantLogo(logoUrl);
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

  await deleteTenantLogo(tenant?.logo_url ?? null);

  const { error } = await supabase
    .from('tenants')
    .update({ logo_url: null })
    .eq('id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app', 'layout');
}
