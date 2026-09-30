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

export type EmployeeTeamOption = { value: string; label: string; roleLabel: string };

/** Aktive Mandanten-Mitarbeiter für Baustellen-Team (optional ohne bereits Zugewiesene). */
export async function loadTenantEmployeeTeamOptions(
  supabase: SupabaseClient,
  tenantId: string,
  excludeUserIds: string[] = [],
): Promise<EmployeeTeamOption[]> {
  const exclude = new Set(excludeUserIds);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, tenant_roles(name, slug)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('last_name');

  return (profiles ?? [])
    .filter((p) => !exclude.has(p.id))
    .map((p) => {
      const roleRaw = p.tenant_roles;
      const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;
      const roleLabel = (role as { name?: string } | null)?.name ?? 'Mitarbeiter';
      const label = `${p.first_name} ${p.last_name}`.trim();
      return { value: p.id, label, roleLabel };
    });
}
