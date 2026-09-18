import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import {
  deleteTenantRole,
  updateTenantRoleName,
} from '@/lib/actions/permissions';
import { RoleDetailHeader } from '@/components/permissions/role-detail-header';
import { RoleMatrixForm } from '@/components/permissions/role-matrix-form';
import { RoleMembersSection } from '@/components/permissions/role-members-section';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { Profile } from '@/lib/types/database';
import type { TenantRole } from '@/lib/tenant/roles';

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'roles.manage')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const { id: roleId } = await params;
  const supabase = await createClient();

  const [
    { data: role },
    { data: perms },
    { data: members },
    { data: allProfiles },
    { data: allRoles },
  ] = await Promise.all([
    supabase.from('tenant_roles').select('*').eq('id', roleId).single(),
    supabase
      .from('tenant_role_permissions')
      .select('permission_key')
      .eq('tenant_role_id', roleId)
      .eq('granted', true),
    supabase
      .from('profiles')
      .select('*')
      .eq('tenant_role_id', roleId)
      .order('last_name'),
    supabase.from('profiles').select('*').order('last_name'),
    supabase.from('tenant_roles').select('*').order('sort_order'),
  ]);

  if (!role) notFound();

  const grantedKeys = (perms ?? []).map((p) => p.permission_key as PermissionKey);
  const memberList = (members ?? []) as Profile[];
  const profileList = (allProfiles ?? []) as Profile[];
  const roleList = (allRoles ?? []) as TenantRole[];

  const assignedIds = new Set(memberList.map((m) => m.id));
  const availableMembers = profileList.filter((p) => !assignedIds.has(p.id));
  const otherRoles = roleList.filter((r) => r.id !== roleId);
  const defaultTargetRoleId =
    roleList.find((r) => r.slug === 'mitarbeiter')?.id ?? otherRoles[0]?.id ?? '';

  return (
    <>
      <RoleDetailHeader role={role as TenantRole} memberCount={memberList.length} />

      <section className="panel form-panel" style={{ marginTop: 16 }}>
        <h2>Stammdaten</h2>
        <form action={updateTenantRoleName} className="input-form">
          <input type="hidden" name="role_id" value={roleId} />
          <div className="input-form-core">
            <label>
              Name
              <input name="name" defaultValue={role.name} required />
            </label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Speichern</button>
          </div>
        </form>
        {!role.is_system && memberList.length === 0 && (
          <form action={deleteTenantRole} style={{ marginTop: 16 }}>
            <input type="hidden" name="role_id" value={roleId} />
            <button type="submit" className="text-button">Rolle löschen</button>
          </form>
        )}
      </section>

      <section className="panel form-panel" style={{ marginTop: 16 }}>
        <h2>Berechtigungen</h2>
        <p className="muted">Festlegen, welche Funktionen mit dieser Rolle sichtbar und nutzbar sind.</p>
        <RoleMatrixForm roleId={roleId} grantedKeys={grantedKeys} />
      </section>

      <RoleMembersSection
        roleId={roleId}
        members={memberList}
        availableMembers={availableMembers}
        otherRoles={otherRoles}
        defaultTargetRoleId={defaultTargetRoleId}
      />
    </>
  );
}
