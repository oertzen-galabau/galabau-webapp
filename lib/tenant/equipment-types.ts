import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_TENANT_EQUIPMENT_TYPES = [
  { name: 'Fahrzeug', sort_order: 10 },
  { name: 'Gerät', sort_order: 20 },
  { name: 'Anhänger', sort_order: 30 },
] as const;

export async function seedTenantEquipmentTypes(
  admin: SupabaseClient,
  tenantId: string,
): Promise<void> {
  const rows = DEFAULT_TENANT_EQUIPMENT_TYPES.map((entry) => ({
    tenant_id: tenantId,
    name: entry.name,
    sort_order: entry.sort_order,
  }));

  for (const row of rows) {
    const { error } = await admin.from('tenant_equipment_types').insert(row);
    if (error && error.code !== '23505') {
      throw new Error(`Fahrzeug-/Gerätetypen konnten nicht angelegt werden: ${error.message}`);
    }
  }
}
