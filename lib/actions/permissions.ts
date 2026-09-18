'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  expandPermissions,
  PERMISSION_KEYS,
  type PermissionKey,
} from '@/lib/auth/permissions';
import { assignProfileToRole } from '@/lib/auth/role-assignment';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { enumRoleFromTenantRoleId, slugifyRoleName } from '@/lib/tenant/roles';

async function requireRolesManage() {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'roles.manage')) throw new Error('Keine Berechtigung');
  return ctx;
}

function revalidateRolePaths(roleId?: string, userId?: string) {
  revalidatePath('/app/rollen');
  if (roleId) revalidatePath(`/app/rollen/${roleId}`);
  revalidatePath('/app/team');
  if (userId) revalidatePath(`/app/team/${userId}`);
}

export async function createTenantRole(formData: FormData) {
  const ctx = await requireRolesManage();
  const name = (formData.get('name') as string)?.trim();
  if (!name) throw new Error('Name ist erforderlich');

  const admin = createAdminClient();
  const baseSlug = slugifyRoleName(name);

  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const { data: existing } = await admin
      .from('tenant_roles')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const { data: roles } = await admin
    .from('tenant_roles')
    .select('sort_order')
    .eq('tenant_id', ctx.tenantId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = (roles?.[0]?.sort_order ?? -1) + 1;

  const { data: newRole, error } = await admin
    .from('tenant_roles')
    .insert({
      tenant_id: ctx.tenantId,
      name,
      slug,
      is_system: false,
      sort_order: sortOrder,
    })
    .select('id')
    .single();

  if (error || !newRole) throw new Error(error?.message ?? 'Rolle konnte nicht angelegt werden');
  revalidatePath('/app/rollen');
  redirect(`/app/rollen/${newRole.id}`);
}

export async function updateTenantRoleName(formData: FormData) {
  const ctx = await requireRolesManage();
  const roleId = formData.get('role_id') as string;
  const name = (formData.get('name') as string)?.trim();
  if (!roleId || !name) throw new Error('Ungültige Eingabe');

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_roles')
    .update({ name })
    .eq('id', roleId)
    .eq('tenant_id', ctx.tenantId);

  if (error) throw new Error(error.message);
  revalidateRolePaths(roleId);
}

export async function deleteTenantRole(formData: FormData) {
  const ctx = await requireRolesManage();
  const roleId = formData.get('role_id') as string;
  if (!roleId) throw new Error('Keine Rolle ausgewählt');

  const admin = createAdminClient();

  const { data: role } = await admin
    .from('tenant_roles')
    .select('is_system')
    .eq('id', roleId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!role) throw new Error('Rolle nicht gefunden');
  if (role.is_system) throw new Error('System-Rollen können nicht gelöscht werden');

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_role_id', roleId);

  if ((count ?? 0) > 0) throw new Error('Rolle ist noch Mitarbeitern zugewiesen');

  const { error } = await admin.from('tenant_roles').delete().eq('id', roleId);
  if (error) throw new Error(error.message);
  revalidatePath('/app/rollen');
  redirect('/app/rollen');
}

export async function updateRolePermissions(formData: FormData) {
  const ctx = await requireRolesManage();
  const roleId = formData.get('role_id') as string;
  if (!roleId) throw new Error('Keine Rolle ausgewählt');

  const admin = createAdminClient();

  const { data: role } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('id', roleId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!role) throw new Error('Rolle nicht gefunden');

  const selected = PERMISSION_KEYS.filter((key) => formData.get(`perm_${key}`) === 'on');
  const expanded = expandPermissions(selected);

  if (!expanded.has('roles.manage')) {
    const { data: otherRoles } = await admin
      .from('tenant_roles')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .neq('id', roleId);

    let othersHaveManage = false;
    for (const other of otherRoles ?? []) {
      const { data: perm } = await admin
        .from('tenant_role_permissions')
        .select('permission_key')
        .eq('tenant_role_id', other.id)
        .eq('permission_key', 'roles.manage')
        .eq('granted', true)
        .maybeSingle();
      if (perm) {
        othersHaveManage = true;
        break;
      }
    }

    if (!othersHaveManage) {
      throw new Error('Mindestens eine Rolle muss „Rollen verwalten" behalten.');
    }
  }

  await admin.from('tenant_role_permissions').delete().eq('tenant_role_id', roleId);

  if (expanded.size > 0) {
    const rows = [...expanded].map((permission_key) => ({
      tenant_role_id: roleId,
      permission_key,
      granted: true,
    }));
    const { error } = await admin.from('tenant_role_permissions').insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidateRolePaths(roleId);
  revalidatePath('/app', 'layout');
}

export async function assignMemberToRole(formData: FormData) {
  const ctx = await requireRolesManage();
  const roleId = formData.get('role_id') as string;
  const userId = formData.get('user_id') as string;

  if (!roleId || !userId) throw new Error('Ungültige Eingabe');

  const admin = createAdminClient();

  const { data: role } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('id', roleId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!role) throw new Error('Rolle nicht gefunden');

  const enumRole = await enumRoleFromTenantRoleId(admin, roleId);

  await assignProfileToRole(admin, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    targetUserId: userId,
    newRoleId: roleId,
    enumRole,
  });

  revalidateRolePaths(roleId, userId);
}

export async function removeMemberFromRole(formData: FormData) {
  const ctx = await requireRolesManage();
  const roleId = formData.get('role_id') as string;
  const userId = formData.get('user_id') as string;
  const targetRoleId = formData.get('target_role_id') as string;

  if (!roleId || !userId || !targetRoleId) throw new Error('Ungültige Eingabe');
  if (roleId === targetRoleId) throw new Error('Ziel-Rolle muss abweichen');

  const admin = createAdminClient();

  const { data: role } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('id', roleId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!role) throw new Error('Rolle nicht gefunden');

  const { data: targetRole } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('id', targetRoleId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!targetRole) throw new Error('Ziel-Rolle nicht gefunden');

  const { data: profile } = await admin
    .from('profiles')
    .select('tenant_role_id')
    .eq('id', userId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!profile || profile.tenant_role_id !== roleId) {
    throw new Error('Mitarbeiter ist dieser Rolle nicht zugewiesen');
  }

  const enumRole = await enumRoleFromTenantRoleId(admin, targetRoleId);

  await assignProfileToRole(admin, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    targetUserId: userId,
    newRoleId: targetRoleId,
    enumRole,
  });

  revalidateRolePaths(roleId, userId);
  revalidateRolePaths(targetRoleId, userId);
}

export async function getRolePermissionKeys(roleId: string): Promise<PermissionKey[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenant_role_permissions')
    .select('permission_key')
    .eq('tenant_role_id', roleId)
    .eq('granted', true);

  return (data ?? []).map((r) => r.permission_key as PermissionKey);
}
