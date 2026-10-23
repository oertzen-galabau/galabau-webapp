import type { SupabaseClient } from '@supabase/supabase-js';

export type ScheduleEntryRow = {
  site_id: string;
  start_time: string;
  end_time: string;
  foreman_user_id: string | null;
  external_workers_text: string | null;
  notes: string | null;
  sort_order: number;
  schedule_entry_members?: { user_id: string }[];
  schedule_entry_equipment?: { equipment_id: string }[];
};

/** Normalisiert Supabase-Joins für Kopieren (Mitglieder + Geräte). */
export function normalizeScheduleEntryCopyRow(row: Record<string, unknown>): ScheduleEntryRow {
  const membersRaw = row.schedule_entry_members;
  const schedule_entry_members = Array.isArray(membersRaw)
    ? membersRaw
        .map((item) => {
          if (!item || typeof item !== 'object' || !('user_id' in item)) return null;
          const user_id = String(item.user_id).trim();
          return user_id ? { user_id } : null;
        })
        .filter((item): item is { user_id: string } => item !== null)
    : [];

  const equipmentRaw = row.schedule_entry_equipment;
  const schedule_entry_equipment = Array.isArray(equipmentRaw)
    ? equipmentRaw
        .map((item) => {
          if (!item || typeof item !== 'object' || !('equipment_id' in item)) return null;
          const equipment_id = String(item.equipment_id).trim();
          return equipment_id ? { equipment_id } : null;
        })
        .filter((item): item is { equipment_id: string } => item !== null)
    : [];

  return {
    site_id: String(row.site_id),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
    foreman_user_id: (row.foreman_user_id as string | null) ?? null,
    external_workers_text: (row.external_workers_text as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    schedule_entry_members,
    schedule_entry_equipment,
  };
}

async function assertEquipmentInTenant(
  supabase: SupabaseClient,
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
  if ((data?.length ?? 0) !== equipmentIds.length) {
    throw new Error('Fahrzeug/Gerät nicht gefunden');
  }
}

async function replaceScheduleEntryMembers(
  supabase: SupabaseClient,
  tenantId: string,
  entryId: string,
  memberUserIds: string[],
) {
  await supabase.from('schedule_entry_members').delete().eq('schedule_entry_id', entryId);
  if (!memberUserIds.length) return;
  const { error } = await supabase.from('schedule_entry_members').insert(
    memberUserIds.map((user_id) => ({
      tenant_id: tenantId,
      schedule_entry_id: entryId,
      user_id,
    })),
  );
  if (error) throw new Error(error.message);
}

async function replaceScheduleEntryEquipment(
  supabase: SupabaseClient,
  tenantId: string,
  entryId: string,
  equipmentIds: string[],
) {
  const uniqueIds = [...new Set(equipmentIds)];
  await assertEquipmentInTenant(supabase, tenantId, uniqueIds);
  await supabase.from('schedule_entry_equipment').delete().eq('schedule_entry_id', entryId);
  if (!uniqueIds.length) return;
  const { error } = await supabase.from('schedule_entry_equipment').insert(
    uniqueIds.map((equipment_id) => ({
      tenant_id: tenantId,
      schedule_entry_id: entryId,
      equipment_id,
    })),
  );
  if (error) throw new Error(error.message);
}

async function applyEntryRelations(
  supabase: SupabaseClient,
  tenantId: string,
  entryId: string,
  row: ScheduleEntryRow,
) {
  const memberUserIds = (row.schedule_entry_members ?? []).map((m) => m.user_id);
  const equipmentIds = (row.schedule_entry_equipment ?? []).map((e) => e.equipment_id);
  await replaceScheduleEntryMembers(supabase, tenantId, entryId, memberUserIds);
  await replaceScheduleEntryEquipment(supabase, tenantId, entryId, equipmentIds);
}

/** Legt einen Einsatz an einem Tag an (Kopie inkl. Mitglieder/Geräte). */
export async function insertScheduleEntryCopy(
  supabase: SupabaseClient,
  tenantId: string,
  createdBy: string,
  row: ScheduleEntryRow | Record<string, unknown>,
  planDate: string,
): Promise<string> {
  const copy = normalizeScheduleEntryCopyRow(row as Record<string, unknown>);

  const { data: created, error } = await supabase
    .from('schedule_entries')
    .insert({
      tenant_id: tenantId,
      site_id: copy.site_id,
      start_date: planDate,
      end_date: planDate,
      start_time: copy.start_time,
      end_time: copy.end_time,
      foreman_user_id: copy.foreman_user_id,
      external_workers_text: copy.external_workers_text,
      notes: copy.notes,
      sort_order: copy.sort_order,
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await applyEntryRelations(supabase, tenantId, created.id, copy);

  return created.id;
}

/**
 * Kopiert einen Einsatz auf einen Tag — neu anlegen oder vorhandenen (gleiche Baustelle) vollständig überschreiben.
 */
export async function upsertScheduleEntryCopy(
  supabase: SupabaseClient,
  tenantId: string,
  createdBy: string,
  row: ScheduleEntryRow | Record<string, unknown>,
  planDate: string,
): Promise<'created' | 'updated'> {
  const copy = normalizeScheduleEntryCopyRow(row as Record<string, unknown>);

  const { data: existing } = await supabase
    .from('schedule_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('site_id', copy.site_id)
    .eq('start_date', planDate)
    .eq('end_date', planDate)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('schedule_entries')
      .update({
        start_time: copy.start_time,
        end_time: copy.end_time,
        foreman_user_id: copy.foreman_user_id,
        external_workers_text: copy.external_workers_text,
        notes: copy.notes,
        sort_order: copy.sort_order,
      })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);

    await applyEntryRelations(supabase, tenantId, existing.id, copy);
    return 'updated';
  }

  await insertScheduleEntryCopy(supabase, tenantId, createdBy, copy, planDate);
  return 'created';
}
