import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { InviteEmployeeForm } from '@/components/team/invite-employee-form';
import { MemberAccessBadge } from '@/components/team/member-access-badge';
import { TeamMemberRowActions } from '@/components/team/team-member-row-actions';

export default async function TeamPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'team.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const tenantId = ctx.tenant!.id;
  const supabase = await createClient();
  const [{ data: members }, { data: tenantRoles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, tenant_roles(name)')
      .eq('tenant_id', tenantId)
      .order('last_name'),
    supabase.from('tenant_roles').select('*').eq('tenant_id', tenantId).order('sort_order'),
  ]);

  const canInvite = canAccess(ctx, 'team.invite');
  const canDeactivate = canAccess(ctx, 'team.deactivate');
  const canDelete = canAccess(ctx, 'team.delete') || canAccess(ctx, 'team.deactivate');
  const showRowActions = canDeactivate || canDelete;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Verwaltung</span>
          <h1>Team & Mitarbeiter</h1>
          <p>Mitarbeiter verwalten, Rollen zuweisen und Details einsehen.</p>
        </div>
      </div>

      {canInvite && (
        <InviteEmployeeForm
          roles={(tenantRoles ?? []).map((role) => ({ value: role.id, label: role.name }))}
        />
      )}

      <section
        className={`panel team-list team-list--links${showRowActions ? ' team-list--with-actions' : ''}`}
        style={{ marginTop: 16 }}
      >
        {(members ?? []).map((member) => {
          const roleName = (member.tenant_roles as { name: string } | null)?.name ?? '—';
          return (
            <div className="team-row team-row--list" key={member.id}>
              <Link href={`/app/team/${member.id}`} className="team-row-main">
                <span className="person-avatar">{member.first_name[0]}{member.last_name[0]}</span>
                <span className="team-row-person">
                  <strong>{member.first_name} {member.last_name}</strong>
                  <small>{roleName}</small>
                </span>
                <span className="team-location">
                  <i className={member.is_active ? 'active' : ''} />
                  {member.email}
                </span>
                <span className="team-row-status">
                  <MemberAccessBadge
                    is_active={member.is_active}
                    must_change_password={member.must_change_password}
                  />
                </span>
              </Link>
              {showRowActions && (
                <TeamMemberRowActions
                  memberId={member.id}
                  memberName={`${member.first_name} ${member.last_name}`}
                  isActive={member.is_active}
                  isSelf={member.id === ctx.userId}
                  canDeactivate={canDeactivate}
                  canDelete={canDelete}
                />
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
