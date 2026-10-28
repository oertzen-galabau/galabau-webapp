import type { SupabaseClient } from '@supabase/supabase-js';

export type ForemanOption = { value: string; label: string };

/** Gewählte Person in Optionsliste, falls Rolle/Filter sie sonst ausblendet. */
export async function withProfileOption(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null | undefined,
  options: ForemanOption[],
): Promise<ForemanOption[]> {
  if (!userId || options.some((o) => o.value === userId)) return options;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!profile) return options;
  const label = `${profile.first_name} ${profile.last_name}`.trim() || 'Mitarbeiter';
  return [{ value: profile.id, label }, ...options];
}

/** Vorarbeiter zuerst, danach alle weiteren aktiven Mitarbeiter (Baustellen-Vorarbeiter-Auswahl). */
export async function loadForemanOptions(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ForemanOption[]> {
  const { data: roles } = await supabase
    .from('tenant_roles')
    .select('id, slug')
    .eq('tenant_id', tenantId)
    .eq('slug', 'vorarbeiter');

  const foremanRoleIds = new Set((roles ?? []).map((r) => r.id));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, tenant_role_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('last_name');

  const toOption = (p: { id: string; first_name: string; last_name: string }): ForemanOption => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`.trim(),
  });

  const list = profiles ?? [];
  const foremen = list.filter((p) => p.tenant_role_id && foremanRoleIds.has(p.tenant_role_id));
  const others = list.filter((p) => !p.tenant_role_id || !foremanRoleIds.has(p.tenant_role_id));

  return [...foremen.map(toOption), ...others.map(toOption)];
}

export type EmployeeTeamOption = { value: string; label: string; roleLabel: string };

/** Bauleiter-Kandidaten (Verwaltung / Administrator). */
export async function loadSiteManagerOptions(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ForemanOption[]> {
  const { data: roles } = await supabase
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('slug', ['verwaltung', 'administrator']);

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
