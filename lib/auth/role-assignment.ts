import type { SupabaseClient } from '@supabase/supabase-js';

export async function assertRoleChangeAllowed(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    currentRoleId: string | null;
    newRoleId: string;
  },
): Promise<void> {
  const { tenantId, actorUserId, targetUserId, currentRoleId, newRoleId } = params;

  if (currentRoleId === newRoleId) return;

  const { data: tenantRole } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('id', newRoleId)
    .eq('tenant_id', tenantId)
    .single();

  if (!tenantRole) throw new Error('Ungültige Rolle');

  const { data: targetProfile, error: fetchError } = await admin
    .from('profiles')
    .select('id, tenant_id, tenant_role_id')
    .eq('id', targetUserId)
    .single();

  if (fetchError || !targetProfile) {
    throw new Error('Mitarbeiter nicht gefunden');
  }

  if (targetProfile.tenant_id !== tenantId) {
    throw new Error('Keine Berechtigung');
  }

  if (targetUserId === actorUserId && targetProfile.tenant_role_id !== newRoleId) {
    const { data: manageRoles } = await admin
      .from('tenant_role_permissions')
      .select('tenant_role_id')
      .eq('permission_key', 'roles.manage')
      .eq('granted', true);

    const manageRoleIds = (manageRoles ?? []).map((r) => r.tenant_role_id);
    if (manageRoleIds.includes(targetProfile.tenant_role_id ?? '')) {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('tenant_role_id', manageRoleIds)
        .eq('is_active', true);

      if ((count ?? 0) <= 1) {
        throw new Error('Sie sind der letzte Administrator. Rollenwechsel nicht möglich.');
      }
    }
  }
}

export async function assignProfileToRole(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    newRoleId: string;
    enumRole: 'verwaltung' | 'administrator' | 'vorarbeiter' | 'mitarbeiter';
  },
): Promise<void> {
  const { tenantId, actorUserId, targetUserId, newRoleId, enumRole } = params;

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, tenant_id, tenant_role_id')
    .eq('id', targetUserId)
    .single();

  if (!targetProfile || targetProfile.tenant_id !== tenantId) {
    throw new Error('Mitarbeiter nicht gefunden');
  }

  await assertRoleChangeAllowed(admin, {
    tenantId,
    actorUserId,
    targetUserId,
    currentRoleId: targetProfile.tenant_role_id,
    newRoleId,
  });

  const { error } = await admin
    .from('profiles')
    .update({ tenant_role_id: newRoleId, role: enumRole })
    .eq('id', targetUserId);

  if (error) throw new Error(error.message);
}
