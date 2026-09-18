import Link from 'next/link';
import { assignMemberToRole, removeMemberFromRole } from '@/lib/actions/permissions';
import { initials } from '@/lib/auth/roles';
import type { Profile } from '@/lib/types/database';
import type { TenantRole } from '@/lib/tenant/roles';
import { AppSelect } from '@/components/ui/app-select';

type Props = {
  roleId: string;
  members: Profile[];
  availableMembers: Profile[];
  otherRoles: TenantRole[];
  defaultTargetRoleId: string;
};

export function RoleMembersSection({
  roleId,
  members,
  availableMembers,
  otherRoles,
  defaultTargetRoleId,
}: Props) {
  return (
    <section className="panel form-panel employee-section">
      <h2>Mitarbeiter</h2>
      <p className="muted">Bestehende Mitarbeiter dieser Rolle zuweisen oder entfernen.</p>

      {availableMembers.length > 0 ? (
        <form action={assignMemberToRole} className="input-form role-member-add-form">
          <input type="hidden" name="role_id" value={roleId} />
          <div className="input-form-core">
            <label>
              Mitarbeiter hinzufügen
              <AppSelect
                name="user_id"
                required
                allowEmpty={false}
                placeholder="Bitte wählen …"
                options={availableMembers.map((member) => ({
                  value: member.id,
                  label: `${member.first_name} ${member.last_name} (${member.email})`,
                }))}
              />
            </label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Hinzufügen</button>
          </div>
        </form>
      ) : (
        <p className="muted">Alle Mitarbeiter sind bereits dieser Rolle zugewiesen.</p>
      )}

      {members.length > 0 ? (
        <div className="team-list team-list--links role-members-list">
          {members.map((member) => (
            <div className="role-member-row" key={member.id}>
              <Link href={`/app/team/${member.id}`} className="team-row team-row--link">
                <span className="person-avatar">{initials(member)}</span>
                <span>
                  <strong>{member.first_name} {member.last_name}</strong>
                  <small>{member.email}</small>
                </span>
                <span className={`status-badge ${member.is_active ? 'active' : 'travel'}`}>
                  {member.is_active ? 'Aktiv' : 'Inaktiv'}
                </span>
              </Link>
              <form action={removeMemberFromRole} className="role-member-remove-form">
                <input type="hidden" name="role_id" value={roleId} />
                <input type="hidden" name="user_id" value={member.id} />
                <label className="team-role-label">
                  Neue Rolle
                  <AppSelect
                    name="target_role_id"
                    defaultValue={defaultTargetRoleId}
                    allowEmpty={false}
                    options={otherRoles.map((role) => ({ value: role.id, label: role.name }))}
                  />
                </label>
                <button type="submit" className="text-button">Entfernen</button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>Noch keine Mitarbeiter in dieser Rolle.</p>
      )}
    </section>
  );
}
