'use server';

import { revalidatePath } from 'next/cache';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { insertScheduleEntryCopy } from '@/lib/schedule/copy-entry';
import { loadSchedulePlanData } from '@/lib/schedule/load-plan-data';
import { syncDailyAssignmentsFromSchedule } from '@/lib/schedule/sync-assignments';
import { addDays, mondayOfWeek } from '@/lib/schedule/week';
import { createClient } from '@/lib/supabase/server';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

const SCHEDULE_PATH = '/app/einsatzplanung';

async function unpublishDayIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  planDate: string,
) {
  await supabase
    .from('schedule_day_publications')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('plan_date', planDate);
}

async function assertSiteInTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  siteId: string,
) {
  const { data } = await supabase.from('sites').select('id').eq('id', siteId).eq('tenant_id', tenantId).maybeSingle();
  if (!data) throw new Error('Baustelle nicht gefunden');
}

async function assertUsersInTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  userIds: string[],
) {
  if (!userIds.length) return;
  const { data } = await supabase.from('profiles').select('id').eq('tenant_id', tenantId).in('id', userIds);
  if ((data?.length ?? 0) !== userIds.length) throw new Error('Mitarbeiter nicht gefunden');
}

async function assertEquipmentInTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  equipmentIds: string[],
) {
  if (!equipmentIds.length) return;
  const { data } = await supabase
    .from('tenant_equipment')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('id', equipmentIds);
  if ((data?.length ?? 0) !== equipmentIds.length) throw new Error('Fahrzeug/Gerät nicht gefunden');
}

async function replaceScheduleEntryEquipment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  entryId: string,
  equipmentIds: string[],
) {
  await assertEquipmentInTenant(supabase, tenantId, equipmentIds);
  await supabase.from('schedule_entry_equipment').delete().eq('schedule_entry_id', entryId);
  if (!equipmentIds.length) return;
  const { error } = await supabase.from('schedule_entry_equipment').insert(
    equipmentIds.map((equipmentId) => ({
      tenant_id: tenantId,
      schedule_entry_id: entryId,
      equipment_id: equipmentId,
    })),
  );
  if (error) throw new Error(error.message);
}

/** Dieselbe Baustelle darf an einem Tag nur einmal eingeplant sein. */
async function assertSiteNotPlannedOnDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  siteId: string,
  planDate: string,
  excludeEntryId?: string,
) {
  let query = supabase
    .from('schedule_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('site_id', siteId)
    .eq('start_date', planDate)
    .eq('end_date', planDate)
    .limit(1);
  if (excludeEntryId) query = query.neq('id', excludeEntryId);
  const { data } = await query;
  if (data?.length) {
    throw new Error('Diese Baustelle ist an diesem Tag bereits eingeplant. Bitte die vorhandene Karte bearbeiten oder verschieben.');
  }
}

function readTime(value: FormDataEntryValue | null, fallback: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return raw.length === 5 ? `${raw}:00` : raw;
}

async function insertEntryFromForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: Awaited<ReturnType<typeof getActionContext>>,
  formData: FormData,
  planDate: string,
) {
  const siteId = String(formData.get('site_id') ?? '');
  await assertSiteNotPlannedOnDay(supabase, ctx.tenantId, siteId, planDate);

  const foremanId = (formData.get('foreman_user_id') as string) || null;
  if (foremanId) await assertUsersInTenant(supabase, ctx.tenantId, [foremanId]);

  await unpublishDayIfNeeded(supabase, ctx.tenantId, planDate);

  const { data, error } = await supabase
    .from('schedule_entries')
    .insert({
      tenant_id: ctx.tenantId,
      site_id: siteId,
      start_date: planDate,
      end_date: planDate,
      start_time: readTime(formData.get('start_time'), '07:00:00'),
      end_time: readTime(formData.get('end_time'), '16:00:00'),
      foreman_user_id: foremanId,
      external_workers_text: (formData.get('external_workers_text') as string)?.trim() || null,
      notes: (formData.get('notes') as string)?.trim() || null,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const memberIds = formData.getAll('member_user_id[]').map(String).filter(Boolean);
  if (memberIds.length) {
    await assertUsersInTenant(supabase, ctx.tenantId, memberIds);
    const { error: memberError } = await supabase.from('schedule_entry_members').insert(
      memberIds.map((userId) => ({
        tenant_id: ctx.tenantId,
        schedule_entry_id: data.id,
        user_id: userId,
      })),
    );
    if (memberError) throw new Error(memberError.message);
  }

  const equipmentIds = formData.getAll('equipment_id[]').map(String).filter(Boolean);
  await replaceScheduleEntryEquipment(supabase, ctx.tenantId, data.id, equipmentIds);

  return data.id;
}

export async function createScheduleEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const siteId = String(formData.get('site_id') ?? '');
  const startDate = String(formData.get('start_date') ?? '');
  if (!siteId || !startDate) throw new Error('Baustelle und Datum sind erforderlich');

  await assertSiteInTenant(supabase, ctx.tenantId, siteId);

  const primaryId = await insertEntryFromForm(supabase, ctx, formData, startDate);

  const extraDates = formData
    .getAll('extra_plan_date[]')
    .map(String)
    .filter(Boolean)
    .filter((d) => d !== startDate);

  for (const day of extraDates) {
    await insertEntryFromForm(supabase, ctx, formData, day);
  }

  revalidatePath(SCHEDULE_PATH);
  return { id: primaryId };
}

export async function updateScheduleEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const entryId = String(formData.get('entry_id') ?? '');
  if (!entryId) throw new Error('Kein Einsatz ausgewählt');

  const { data: existing } = await supabase
    .from('schedule_entries')
    .select('start_date, tenant_id')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (!existing) throw new Error('Einsatz nicht gefunden');

  const siteId = String(formData.get('site_id') ?? '');
  const planDate = String(formData.get('start_date') ?? existing.start_date);
  await assertSiteInTenant(supabase, ctx.tenantId, siteId);
  await assertSiteNotPlannedOnDay(supabase, ctx.tenantId, siteId, planDate, entryId);

  const foremanId = (formData.get('foreman_user_id') as string) || null;
  if (foremanId) await assertUsersInTenant(supabase, ctx.tenantId, [foremanId]);

  await unpublishDayIfNeeded(supabase, ctx.tenantId, planDate);
  if (existing.start_date !== planDate) {
    await unpublishDayIfNeeded(supabase, ctx.tenantId, existing.start_date);
  }

  const { error } = await supabase
    .from('schedule_entries')
    .update({
      site_id: siteId,
      start_date: planDate,
      end_date: planDate,
      start_time: readTime(formData.get('start_time'), '07:00:00'),
      end_time: readTime(formData.get('end_time'), '16:00:00'),
      foreman_user_id: foremanId,
      external_workers_text: (formData.get('external_workers_text') as string)?.trim() || null,
      notes: (formData.get('notes') as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId);
  if (error) throw new Error(error.message);

  const memberIds = formData.getAll('member_user_id[]').map(String).filter(Boolean);
  await assertUsersInTenant(supabase, ctx.tenantId, memberIds);
  await supabase.from('schedule_entry_members').delete().eq('schedule_entry_id', entryId);
  if (memberIds.length) {
    const { error: memberError } = await supabase.from('schedule_entry_members').insert(
      memberIds.map((userId) => ({
        tenant_id: ctx.tenantId,
        schedule_entry_id: entryId,
        user_id: userId,
      })),
    );
    if (memberError) throw new Error(memberError.message);
  }

  const equipmentIds = formData.getAll('equipment_id[]').map(String).filter(Boolean);
  await replaceScheduleEntryEquipment(supabase, ctx.tenantId, entryId, equipmentIds);

  revalidatePath(SCHEDULE_PATH);
}

export async function moveScheduleEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const entryId = String(formData.get('entry_id') ?? '');
  const targetDay = String(formData.get('target_day') ?? '');
  if (!entryId || !targetDay) throw new Error('Ungültige Anfrage');

  const { data: entry } = await supabase
    .from('schedule_entries')
    .select('start_date, site_id')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (!entry) throw new Error('Einsatz nicht gefunden');
  if (entry.start_date === targetDay) return;

  await assertSiteNotPlannedOnDay(supabase, ctx.tenantId, entry.site_id, targetDay, entryId);

  await unpublishDayIfNeeded(supabase, ctx.tenantId, entry.start_date);
  await unpublishDayIfNeeded(supabase, ctx.tenantId, targetDay);

  const { error } = await supabase
    .from('schedule_entries')
    .update({ start_date: targetDay, end_date: targetDay, updated_at: new Date().toISOString() })
    .eq('id', entryId);
  if (error) throw new Error(error.message);

  revalidatePath(SCHEDULE_PATH);
}

export async function deleteScheduleEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();
  const entryId = String(formData.get('entry_id') ?? '');
  if (!entryId) throw new Error('Kein Einsatz ausgewählt');

  const { data: entry } = await supabase
    .from('schedule_entries')
    .select('start_date')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (!entry) throw new Error('Einsatz nicht gefunden');

  await unpublishDayIfNeeded(supabase, ctx.tenantId, entry.start_date);

  const { error } = await supabase.from('schedule_entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);

  revalidatePath(SCHEDULE_PATH);
}

export async function addMemberToScheduleEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const entryId = String(formData.get('entry_id') ?? '');
  const userId = String(formData.get('user_id') ?? '');
  if (!entryId || !userId) throw new Error('Ungültige Anfrage');

  const { data: entry } = await supabase
    .from('schedule_entries')
    .select('start_date')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (!entry) throw new Error('Einsatz nicht gefunden');

  await assertUsersInTenant(supabase, ctx.tenantId, [userId]);
  await unpublishDayIfNeeded(supabase, ctx.tenantId, entry.start_date);

  const { error } = await supabase.from('schedule_entry_members').insert({
    tenant_id: ctx.tenantId,
    schedule_entry_id: entryId,
    user_id: userId,
  });
  if (error && error.code !== '23505') throw new Error(error.message);

  revalidatePath(SCHEDULE_PATH);
}

async function publishDaysAndSync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: Awaited<ReturnType<typeof getActionContext>>,
  days: string[],
) {
  const uniqueDays = [...new Set(days)].sort();
  if (!uniqueDays.length) throw new Error('Keine Einsätze zum Veröffentlichen');

  const weekStart = mondayOfWeek(uniqueDays[0]);
  const plan = await loadSchedulePlanData(supabase, ctx.tenantId, weekStart);

  const now = new Date().toISOString();
  for (const planDate of uniqueDays) {
    await supabase.from('schedule_day_publications').upsert({
      tenant_id: ctx.tenantId,
      plan_date: planDate,
      published_at: now,
      published_by: ctx.userId,
    });
  }

  for (const planDate of uniqueDays) {
    const dayEntries = plan.entries.filter((e) => e.start_date === planDate);
    await syncDailyAssignmentsFromSchedule(
      supabase,
      ctx.tenantId,
      planDate,
      planDate,
      dayEntries.map((e) => ({
        id: e.id,
        site_id: e.site_id,
        start_date: e.start_date,
        end_date: e.end_date,
        start_time: e.start_time,
        memberUserIds: e.members.map((m) => m.user_id),
      })),
    );
  }
}

export async function publishScheduleDay(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.publish');
  const supabase = await createClient();

  const planDate = String(formData.get('plan_date') ?? '');
  if (!planDate) throw new Error('Datum fehlt');

  const weekStart = mondayOfWeek(planDate);
  const plan = await loadSchedulePlanData(supabase, ctx.tenantId, weekStart);
  const hasEntries = plan.entries.some((e) => e.start_date === planDate);
  if (!hasEntries) throw new Error('An diesem Tag sind keine Einsätze eingeplant');

  await publishDaysAndSync(supabase, ctx, [planDate]);

  revalidatePath(SCHEDULE_PATH);
  revalidatePath('/app');
}

export async function publishScheduleWeek(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.publish');
  const supabase = await createClient();

  const weekStart = mondayOfWeek(String(formData.get('week_start') ?? ''));
  const weekEnd = addDays(weekStart, 6);
  const plan = await loadSchedulePlanData(supabase, ctx.tenantId, weekStart);

  const daysWithEntries = [...new Set(plan.entries.map((e) => e.start_date))].filter(
    (d) => d >= weekStart && d <= weekEnd,
  );
  if (!daysWithEntries.length) throw new Error('In dieser Woche sind keine Einsätze eingeplant');

  await publishDaysAndSync(supabase, ctx, daysWithEntries);

  revalidatePath(SCHEDULE_PATH);
  revalidatePath('/app');
}

export async function copyScheduleDay(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const targetDay = String(formData.get('target_day') ?? '');
  if (!targetDay) throw new Error('Zieltag fehlt');
  const sourceDay = String(formData.get('source_day') ?? addDays(targetDay, -1));

  const { data: sourceEntries } = await supabase
    .from('schedule_entries')
    .select('*, schedule_entry_members(user_id), schedule_entry_equipment(equipment_id)')
    .eq('tenant_id', ctx.tenantId)
    .eq('start_date', sourceDay)
    .eq('end_date', sourceDay);

  if (!sourceEntries?.length) throw new Error('Am Quelltag sind keine Einsätze vorhanden');

  await unpublishDayIfNeeded(supabase, ctx.tenantId, targetDay);

  let copied = 0;
  for (const row of sourceEntries) {
    const { data: exists } = await supabase
      .from('schedule_entries')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .eq('site_id', row.site_id)
      .eq('start_date', targetDay)
      .maybeSingle();
    if (exists) continue;

    await insertScheduleEntryCopy(supabase, ctx.tenantId, ctx.userId, row, targetDay);
    copied += 1;
  }

  if (copied === 0) {
    throw new Error('Alle Baustellen vom Quelltag sind am Zieltag bereits eingeplant');
  }

  revalidatePath(SCHEDULE_PATH);
}

export async function copyScheduleWeek(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const targetWeekStart = mondayOfWeek(String(formData.get('week_start') ?? ''));
  const sourceWeekStart = addDays(targetWeekStart, -7);
  const sourceWeekEnd = addDays(sourceWeekStart, 6);

  const { data: sourceRows, error: loadError } = await supabase
    .from('schedule_entries')
    .select('*, schedule_entry_members(user_id), schedule_entry_equipment(equipment_id)')
    .eq('tenant_id', ctx.tenantId)
    .gte('start_date', sourceWeekStart)
    .lte('start_date', sourceWeekEnd);

  if (loadError) throw new Error(loadError.message);
  const entries = (sourceRows ?? []).filter((r) => r.start_date === r.end_date);
  if (!entries.length) throw new Error('Keine Einsätze in der Vorwoche');

  for (let i = 0; i <= 6; i++) {
    const day = addDays(targetWeekStart, i);
    await unpublishDayIfNeeded(supabase, ctx.tenantId, day);
  }

  for (const row of entries) {
    const dayOffset = Math.round(
      (Date.parse(`${row.start_date}T12:00:00Z`) - Date.parse(`${sourceWeekStart}T12:00:00Z`)) / 86400000,
    );
    const newDay = addDays(targetWeekStart, dayOffset);

    const { data: exists } = await supabase
      .from('schedule_entries')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .eq('site_id', row.site_id)
      .eq('start_date', newDay)
      .maybeSingle();
    if (exists) continue;

    await insertScheduleEntryCopy(supabase, ctx.tenantId, ctx.userId, row, newDay);
  }

  revalidatePath(SCHEDULE_PATH);
}
