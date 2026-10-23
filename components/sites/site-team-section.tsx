import { addSiteTeamMember, removeSiteTeamMember } from '@/lib/actions/site-team';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';
import { SiteLeadsForm } from '@/components/sites/site-leads-form';
import { AppSelect } from '@/components/ui/app-select';
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
      <p className="muted site-detail-section-lead">
        Bauleiter, Vorarbeiter und weitere zugewiesene Mitarbeiter sehen diese Baustelle in Zeiten,
        Dokumentation und Tagesrapport.
      </p>

      <SiteLeadsForm
        siteId={siteId}
        siteManagerUserId={siteManagerUserId}
        foremanUserId={foremanUserId}
        siteManagerOptions={siteManagerOptions}
        foremanOptions={foremanOptions}
        canEdit={canEdit}
      />

      {additionalMembers.length > 0 ? (
        <ul className="site-entity-list">
          {additionalMembers.map((member) => (
            <li key={member.id} className="site-entity-row site-team-member-row">
              <div>
                <strong>{member.displayName}</strong>
                <span className="status-badge active" style={{ marginLeft: 8 }}>
                  {member.roleLabel}
                </span>
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
        <form action={addSiteTeamMember} className="input-form" style={{ marginTop: 16 }}>
          <input type="hidden" name="site_id" value={siteId} />
          <div className="input-form-core">
            <label className="input-form-span-full">
              Mitarbeiter hinzufügen
              <AppSelect
                key={`site-team-add-${members.length}`}
                name="user_id"
                required
                allowEmpty={false}
                placeholder="— Person wählen —"
                options={employeeOptions.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.roleLabel})`,
                }))}
              />
            </label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">
              Hinzufügen
            </button>
          </div>
        </form>
      )}

      {canEdit && employeeOptions.length === 0 && additionalMembers.length > 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          Alle aktiven Mitarbeiter sind bereits zugewiesen.
        </p>
      )}
    </section>
  );
}
