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

/** Legt einen Einsatz an einem Tag an (Kopie inkl. Mitglieder/Geräte). */
export async function insertScheduleEntryCopy(
  supabase: SupabaseClient,
  tenantId: string,
  createdBy: string,
  row: ScheduleEntryRow,
  planDate: string,
): Promise<string> {
  const { data: created, error } = await supabase
    .from('schedule_entries')
    .insert({
      tenant_id: tenantId,
      site_id: row.site_id,
      start_date: planDate,
      end_date: planDate,
      start_time: row.start_time,
      end_time: row.end_time,
      foreman_user_id: row.foreman_user_id,
      external_workers_text: row.external_workers_text,
      notes: row.notes,
      sort_order: row.sort_order,
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const members = row.schedule_entry_members ?? [];
  if (members.length) {
    const { error: memberError } = await supabase.from('schedule_entry_members').insert(
      members.map((m) => ({
        tenant_id: tenantId,
        schedule_entry_id: created.id,
        user_id: m.user_id,
      })),
    );
    if (memberError) throw new Error(memberError.message);
  }

  const equipmentRows = row.schedule_entry_equipment ?? [];
  if (equipmentRows.length) {
    const { error: equipmentError } = await supabase.from('schedule_entry_equipment').insert(
      equipmentRows.map((e) => ({
        tenant_id: tenantId,
        schedule_entry_id: created.id,
        equipment_id: e.equipment_id,
      })),
    );
    if (equipmentError) throw new Error(equipmentError.message);
  }

  return created.id;
}
