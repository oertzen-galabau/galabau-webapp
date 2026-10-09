import type { SupabaseClient } from '@supabase/supabase-js';

/** Aktive Profile im Mandanten mit Rolle, die urlaub.approve hat (ohne Antragsteller). */
export async function listLeaveApproverUserIds(
  supabase: SupabaseClient,
  tenantId: string,
  excludeUserId?: string,
): Promise<string[]> {
  const { data: tenantRoles, error: rolesError } = await supabase
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', tenantId);
  if (rolesError) throw new Error(rolesError.message);
  if (!tenantRoles?.length) return [];

  const roleIds = tenantRoles.map((r) => r.id);
  const { data: granted, error: permError } = await supabase
    .from('tenant_role_permissions')
    .select('tenant_role_id')
    .in('tenant_role_id', roleIds)
    .eq('permission_key', 'urlaub.approve')
    .eq('granted', true);
  if (permError) throw new Error(permError.message);

  const approverRoleIds = [...new Set((granted ?? []).map((g) => g.tenant_role_id))];
  if (!approverRoleIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('tenant_role_id', approverRoleIds);
  if (profilesError) throw new Error(profilesError.message);

  return (profiles ?? [])
    .map((p) => p.id)
    .filter((id) => id !== excludeUserId);
}
