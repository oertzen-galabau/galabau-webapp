import Link from 'next/link';
import { assignMemberToRole, removeMemberFromRole } from '@/lib/actions/permissions';
import { initials } from '@/lib/auth/roles';
import type { Profile } from '@/lib/types/database';
import type { TenantRole } from '@/lib/tenant/roles';
import { MemberAccessBadge } from '@/components/team/member-access-badge';
import { AppSelect } from '@/components/ui/app-select';
import { IconActionButton } from '@/components/ui/icon-action-button';
import { Trash2 } from 'lucide-react';

type Props = {
  roleId: string;
  currentRoleName: string;
  members: Profile[];
  availableMembers: Profile[];
  otherRoles: TenantRole[];
};

export function RoleMembersSection({
  roleId,
  currentRoleName,
  members,
  availableMembers,
  otherRoles,
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
      ) : members.length === 0 ? (
        <p className="muted">
          Noch keine Mitarbeiter im Mandanten. Neue Personen legen Sie unter Team & Mitarbeiter an.
        </p>
      ) : null}

      {members.length > 0 ? (
        <ul className="role-members-list">
          {members.map((member) => (
            <li className="role-member-row" key={member.id}>
              <Link href={`/app/team/${member.id}`} className="role-member-identity">
                <span className="person-avatar">{initials(member)}</span>
                <span className="role-member-meta">
                  <strong>{member.first_name} {member.last_name}</strong>
                  <small>{member.email}</small>
                </span>
                <MemberAccessBadge
                  is_active={member.is_active}
                  must_change_password={member.must_change_password}
                />
              </Link>
              <form action={removeMemberFromRole} className="role-member-actions">
                <input type="hidden" name="role_id" value={roleId} />
                <input type="hidden" name="user_id" value={member.id} />
                <div className="role-member-role-field">
                  <span className="role-member-role-caption">Rolle</span>
                  <div className="role-member-role-row">
                    <div className="role-member-role-select">
                      <AppSelect
                        name="target_role_id"
                        placeholder={`${currentRoleName} (aktuell)`}
                        allowEmpty
                        required
                        aria-label="Rolle"
                        options={[
                          { value: roleId, label: `${currentRoleName} (aktuell)`, disabled: true },
                          ...otherRoles.map((role) => ({ value: role.id, label: role.name })),
                        ]}
                      />
                    </div>
                    <IconActionButton type="submit" label="Entfernen" variant="danger">
                      <Trash2 size={18} />
                    </IconActionButton>
                  </div>
                </div>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>Noch keine Mitarbeiter in dieser Rolle.</p>
      )}
    </section>
  );
}
