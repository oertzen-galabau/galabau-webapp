import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_TENANT_WORK_AREAS = [
  { name: 'Geschäftsführung', sort_order: 10, schedule_assignable: false },
  { name: 'Verwaltung', sort_order: 20, schedule_assignable: false },
  { name: 'Baustelle', sort_order: 30, schedule_assignable: true },
  { name: 'Werkstatt/Lager', sort_order: 40, schedule_assignable: true },
] as const;

export async function seedTenantWorkAreas(
  admin: SupabaseClient,
  tenantId: string,
): Promise<void> {
  const rows = DEFAULT_TENANT_WORK_AREAS.map((area) => ({
    tenant_id: tenantId,
    name: area.name,
    sort_order: area.sort_order,
    schedule_assignable: area.schedule_assignable,
  }));

  const { error } = await admin.from('tenant_work_areas').upsert(rows, {
    onConflict: 'tenant_id,name',
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(`Mitarbeiter-Bereiche konnten nicht angelegt werden: ${error.message}`);
  }
}
