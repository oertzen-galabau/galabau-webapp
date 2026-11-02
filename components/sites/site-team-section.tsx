import { removeSiteTeamMember } from '@/lib/actions/site-team';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';
import { SiteLeadsForm } from '@/components/sites/site-leads-form';
import { SiteTeamAddDialog } from '@/components/sites/site-team-add-dialog';
import type { ForemanOption, EmployeeTeamOption } from '@/lib/sites/foremen-options';

export type SiteTeamMemberRow = {
  id: string;
  userId: string;
  displayName: string;
  roleLabel: string;
};

type Props = {
  siteId: string;
  siteManagerUserId: string | null;
  foremanUserId: string | null;
  siteManagerOptions: ForemanOption[];
  foremanOptions: ForemanOption[];
  members: SiteTeamMemberRow[];
  employeeOptions: EmployeeTeamOption[];
  canEdit: boolean;
};

export function SiteTeamSection({
  siteId,
  siteManagerUserId,
  foremanUserId,
  siteManagerOptions,
  foremanOptions,
  members,
  employeeOptions,
  canEdit,
}: Props) {
  const leadUserIds = new Set(
    [siteManagerUserId, foremanUserId].filter((id): id is string => Boolean(id)),
  );
  const additionalMembers = members.filter((m) => !leadUserIds.has(m.userId));

  return (
    <section className="site-detail-section">
      <h2>Baustellen-Team</h2>

      <SiteLeadsForm
        siteId={siteId}
        siteManagerUserId={siteManagerUserId}
        foremanUserId={foremanUserId}
        siteManagerOptions={siteManagerOptions}
        foremanOptions={foremanOptions}
        canEdit={canEdit}
      />

      {additionalMembers.length > 0 ? (
        <ul className="site-entity-list site-team-member-list">
          {additionalMembers.map((member) => (
            <li key={member.id} className="site-entity-row site-team-member-row">
              <div className="site-team-member-row-main">
                <strong>{member.displayName}</strong>
              </div>
              {canEdit && (
                <SiteEntityDeleteButton
                  id={member.id}
                  entityLabel={member.displayName}
                  onDelete={removeSiteTeamMember}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Keine weiteren Teammitglieder zugewiesen.</p>
      )}

      {canEdit && employeeOptions.length > 0 && (
        <div className="site-team-add-trigger">
          <SiteTeamAddDialog siteId={siteId} employeeOptions={employeeOptions} resetKey={members.length} />
        </div>
      )}

      {canEdit && employeeOptions.length === 0 && additionalMembers.length > 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          Alle aktiven Mitarbeiter sind bereits zugewiesen.
        </p>
      )}
    </section>
  );
}
