import type { SupabaseClient } from '@supabase/supabase-js';

export type ForemanOption = { value: string; label: string };

/** Aktive Vorarbeiter des Mandanten (System-Rolle slug vorarbeiter). */
export async function loadForemanOptions(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ForemanOption[]> {
  const { data: roles } = await supabase
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', 'vorarbeiter');

  const roleIds = (roles ?? []).map((r) => r.id);
  if (!roleIds.length) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('tenant_role_id', roleIds)
    .order('last_name');

  return (profiles ?? []).map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`.trim(),
  }));
}
