'use server';

import { revalidatePath } from 'next/cache';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { loadSchedulePlanData } from '@/lib/schedule/load-plan-data';
import { syncDailyAssignmentsFromSchedule } from '@/lib/schedule/sync-assignments';
import { addDays, mondayOfWeek, parseIsoDate } from '@/lib/schedule/week';
import { createClient } from '@/lib/supabase/server';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

const SCHEDULE_PATH = '/app/einsatzplanung';

async function unpublishWeekIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  weekStart: string,
) {
  await supabase
    .from('schedule_week_publications')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('week_start', weekStart);
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
async function assertSiteNotPlannedInRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  siteId: string,
  startDate: string,
  endDate: string,
  excludeEntryId?: string,
) {
  let query = supabase
    .from('schedule_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('site_id', siteId)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
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

export async function createScheduleEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const siteId = String(formData.get('site_id') ?? '');
  const startDate = String(formData.get('start_date') ?? '');
  const endDate = String(formData.get('end_date') ?? startDate);
  if (!siteId || !startDate) throw new Error('Baustelle und Datum sind erforderlich');

  await assertSiteInTenant(supabase, ctx.tenantId, siteId);
  await assertSiteNotPlannedInRange(supabase, ctx.tenantId, siteId, startDate, endDate);

  const foremanId = (formData.get('foreman_user_id') as string) || null;
  if (foremanId) await assertUsersInTenant(supabase, ctx.tenantId, [foremanId]);

  const weekStart = mondayOfWeek(startDate);
  await unpublishWeekIfNeeded(supabase, ctx.tenantId, weekStart);

  const { data, error } = await supabase
    .from('schedule_entries')
    .insert({
      tenant_id: ctx.tenantId,
      site_id: siteId,
      start_date: startDate,
      end_date: endDate,
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

  revalidatePath(SCHEDULE_PATH);
  return { id: data.id };
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
  const startDate = String(formData.get('start_date') ?? existing.start_date);
  const endDate = String(formData.get('end_date') ?? startDate);
  await assertSiteInTenant(supabase, ctx.tenantId, siteId);
  await assertSiteNotPlannedInRange(supabase, ctx.tenantId, siteId, startDate, endDate, entryId);

  const foremanId = (formData.get('foreman_user_id') as string) || null;
  if (foremanId) await assertUsersInTenant(supabase, ctx.tenantId, [foremanId]);

  await unpublishWeekIfNeeded(supabase, ctx.tenantId, mondayOfWeek(startDate));
  if (mondayOfWeek(existing.start_date) !== mondayOfWeek(startDate)) {
    await unpublishWeekIfNeeded(supabase, ctx.tenantId, mondayOfWeek(existing.start_date));
  }

  const { error } = await supabase
    .from('schedule_entries')
    .update({
      site_id: siteId,
      start_date: startDate,
      end_date: endDate,
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
    .select('start_date, end_date')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (!entry) throw new Error('Einsatz nicht gefunden');

  const span = Math.round(
    (parseIsoDate(entry.end_date).getTime() - parseIsoDate(entry.start_date).getTime()) / 86400000,
  );
  const newEnd = addDays(targetDay, span);

  const { data: movedEntry } = await supabase
    .from('schedule_entries')
    .select('site_id')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (movedEntry) {
    await assertSiteNotPlannedInRange(supabase, ctx.tenantId, movedEntry.site_id, targetDay, newEnd, entryId);
  }

  await unpublishWeekIfNeeded(supabase, ctx.tenantId, mondayOfWeek(targetDay));

  const { error } = await supabase
    .from('schedule_entries')
    .update({ start_date: targetDay, end_date: newEnd, updated_at: new Date().toISOString() })
    .eq('id', entryId);
  if (error) throw new Error(error.message);

  revalidatePath(SCHEDULE_PATH);
}

export async function resizeScheduleEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const entryId = String(formData.get('entry_id') ?? '');
  const endDate = String(formData.get('end_date') ?? '');
  if (!entryId || !endDate) throw new Error('Ungültige Anfrage');

  const { data: entry } = await supabase
    .from('schedule_entries')
    .select('start_date')
    .eq('id', entryId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (!entry) throw new Error('Einsatz nicht gefunden');
  if (endDate < entry.start_date) throw new Error('Enddatum vor Startdatum');

  await unpublishWeekIfNeeded(supabase, ctx.tenantId, mondayOfWeek(entry.start_date));

  const { error } = await supabase
    .from('schedule_entries')
    .update({ end_date: endDate, updated_at: new Date().toISOString() })
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

  await unpublishWeekIfNeeded(supabase, ctx.tenantId, mondayOfWeek(entry.start_date));

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
  await unpublishWeekIfNeeded(supabase, ctx.tenantId, mondayOfWeek(entry.start_date));

  const { error } = await supabase.from('schedule_entry_members').insert({
    tenant_id: ctx.tenantId,
    schedule_entry_id: entryId,
    user_id: userId,
  });
  if (error && error.code !== '23505') throw new Error(error.message);

  revalidatePath(SCHEDULE_PATH);
}

export async function publishScheduleWeek(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.publish');
  const supabase = await createClient();

  const weekStart = mondayOfWeek(String(formData.get('week_start') ?? ''));
  const weekEnd = addDays(weekStart, 5);

  const plan = await loadSchedulePlanData(supabase, ctx.tenantId, weekStart);

  await supabase.from('schedule_week_publications').upsert({
    tenant_id: ctx.tenantId,
    week_start: weekStart,
    published_at: new Date().toISOString(),
    published_by: ctx.userId,
  });

  await syncDailyAssignmentsFromSchedule(
    supabase,
    ctx.tenantId,
    weekStart,
    weekEnd,
    plan.entries.map((e) => ({
      id: e.id,
      site_id: e.site_id,
      start_date: e.start_date,
      end_date: e.end_date,
      start_time: e.start_time,
      memberUserIds: e.members.map((m) => m.user_id),
    })),
  );

  revalidatePath(SCHEDULE_PATH);
  revalidatePath('/app');
}

export async function copyScheduleWeek(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'schedule.manage');
  const supabase = await createClient();

  const targetWeekStart = mondayOfWeek(String(formData.get('week_start') ?? ''));
  const sourceWeekStart = addDays(targetWeekStart, -7);
  const sourceWeekEnd = addDays(sourceWeekStart, 6);

  const { data: sourceEntries } = await supabase
    .from('schedule_entries')
    .select('*, schedule_entry_members(user_id), schedule_entry_equipment(equipment_id)')
    .eq('tenant_id', ctx.tenantId)
    .lte('start_date', sourceWeekEnd)
    .gte('end_date', sourceWeekStart);

  if (!sourceEntries?.length) throw new Error('Keine Einsätze in der Vorwoche');

  await unpublishWeekIfNeeded(supabase, ctx.tenantId, targetWeekStart);

  for (const row of sourceEntries) {
    const dayOffset = Math.round(
      (parseIsoDate(row.start_date).getTime() - parseIsoDate(sourceWeekStart).getTime()) / 86400000,
    );
    const span = Math.round(
      (parseIsoDate(row.end_date).getTime() - parseIsoDate(row.start_date).getTime()) / 86400000,
    );
    const newStart = addDays(targetWeekStart, dayOffset);
    const newEnd = addDays(newStart, span);

    const { data: created, error } = await supabase
      .from('schedule_entries')
      .insert({
        tenant_id: ctx.tenantId,
        site_id: row.site_id,
        start_date: newStart,
        end_date: newEnd,
        start_time: row.start_time,
        end_time: row.end_time,
        foreman_user_id: row.foreman_user_id,
        external_workers_text: row.external_workers_text,
        notes: row.notes,
        sort_order: row.sort_order,
        created_by: ctx.userId,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    const members = (row.schedule_entry_members ?? []) as { user_id: string }[];
    if (members.length) {
      const { error: memberError } = await supabase.from('schedule_entry_members').insert(
        members.map((m) => ({
          tenant_id: ctx.tenantId,
          schedule_entry_id: created.id,
          user_id: m.user_id,
        })),
      );
      if (memberError) throw new Error(memberError.message);
    }

    const equipmentRows = (row.schedule_entry_equipment ?? []) as { equipment_id: string }[];
    if (equipmentRows.length) {
      const { error: equipmentError } = await supabase.from('schedule_entry_equipment').insert(
        equipmentRows.map((e) => ({
          tenant_id: ctx.tenantId,
          schedule_entry_id: created.id,
          equipment_id: e.equipment_id,
        })),
      );
      if (equipmentError) throw new Error(equipmentError.message);
    }
  }

  revalidatePath(SCHEDULE_PATH);
}
