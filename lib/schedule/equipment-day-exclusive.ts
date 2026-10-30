import type { SupabaseClient } from '@supabase/supabase-js';
import { formatGermanDate } from '@/lib/schedule/week';

export type EquipmentDayUsage = {
  date: string;
  entryId: string;
  siteName: string;
  equipmentId: string;
  equipmentName: string;
};

export type ScheduleEntryEquipmentLookup = {
  id: string;
  start_date: string;
  site: { name: string };
  equipment: { equipment_id: string; name: string }[];
};

/** Erster Treffer: Gerät an einem Plan-Tag bereits in anderem Einsatz. */
export function findEquipmentUsageOnPlanDates(
  entries: ScheduleEntryEquipmentLookup[],
  planDates: string[],
  equipmentId: string,
  excludeEntryId?: string | null,
): EquipmentDayUsage | undefined {
  const dateSet = new Set(planDates.filter(Boolean));
  if (!dateSet.size) return undefined;

  for (const entry of entries) {
    if (!dateSet.has(entry.start_date)) continue;
    if (excludeEntryId && entry.id === excludeEntryId) continue;
    for (const eq of entry.equipment) {
      if (eq.equipment_id === equipmentId) {
        return {
          date: entry.start_date,
          entryId: entry.id,
          siteName: entry.site.name,
          equipmentId,
          equipmentName: eq.name,
        };
      }
    }
  }
  return undefined;
}

export async function assertEquipmentAvailableOnDays(
  supabase: SupabaseClient,
  tenantId: string,
  equipmentIds: string[],
  dates: string[],
  excludeEntryId?: string,
): Promise<void> {
  const uniqueIds = [...new Set(equipmentIds.filter(Boolean))];
  const uniqueDates = [...new Set(dates.filter(Boolean))];
  if (!uniqueIds.length || !uniqueDates.length) return;

  const { data: rows, error } = await supabase
    .from('schedule_entries')
    .select(
      `
      id,
      start_date,
      sites!inner ( name ),
      schedule_entry_equipment (
        equipment_id,
        tenant_equipment ( name )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .in('start_date', uniqueDates);

  if (error) throw new Error(error.message);

  for (const row of rows ?? []) {
    if (excludeEntryId && row.id === excludeEntryId) continue;
    const siteRaw = row.sites as { name: string } | { name: string }[] | null;
    const siteName = Array.isArray(siteRaw) ? siteRaw[0]?.name : siteRaw?.name;
    const siteLabel = siteName?.trim() || 'Baustelle';

    const links = (row.schedule_entry_equipment ?? []) as {
      equipment_id: string;
      tenant_equipment: { name: string } | { name: string }[] | null;
    }[];

    for (const link of links) {
      if (!uniqueIds.includes(link.equipment_id)) continue;
      const eqRaw = link.tenant_equipment;
      const eqName = (Array.isArray(eqRaw) ? eqRaw[0]?.name : eqRaw?.name)?.trim() || 'Fahrzeug/Gerät';
      throw new Error(
        `${eqName} ist am ${formatGermanDate(String(row.start_date))} bereits bei ${siteLabel} eingeplant.`,
      );
    }
  }
}
