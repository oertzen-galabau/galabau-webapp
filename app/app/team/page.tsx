import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { InviteEmployeeForm } from '@/components/team/invite-employee-form';
import { TeamMemberList } from '@/components/team/team-member-list';
import type { TeamMemberListItem } from '@/components/team/team-member-list';

export default async function TeamPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'team.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const tenantId = ctx.tenant!.id;
  const supabase = await createClient();
  const [{ data: members }, { data: tenantRoles }, { data: workAreas }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, tenant_roles(name)')
      .eq('tenant_id', tenantId)
      .order('last_name'),
    supabase.from('tenant_roles').select('*').eq('tenant_id', tenantId).order('sort_order'),
    supabase
      .from('tenant_work_areas')
      .select('id, name, is_active')
      .eq('tenant_id', tenantId)
      .order('sort_order'),
  ]);

  const canInvite = canAccess(ctx, 'team.invite');
  const canDeactivate = canAccess(ctx, 'team.deactivate');
  const canDelete = canAccess(ctx, 'team.delete') || canAccess(ctx, 'team.deactivate');
  const showRowActions = canDeactivate || canDelete;

  const memberRows = (members ?? []) as TeamMemberListItem[];

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Team & Mitarbeiter</h1>
          <p>Mitarbeiter verwalten, Rollen zuweisen und Details einsehen.</p>
        </div>
      </div>

      {canInvite && (
        <InviteEmployeeForm
          roles={(tenantRoles ?? []).map((role) => ({ value: role.id, label: role.name }))}
          workAreas={workAreas ?? []}
        />
      )}

      <TeamMemberList
        members={memberRows}
        currentUserId={ctx.userId}
        showRowActions={showRowActions}
        canDeactivate={canDeactivate}
        canDelete={canDelete}
      />
    </>
  );
}
