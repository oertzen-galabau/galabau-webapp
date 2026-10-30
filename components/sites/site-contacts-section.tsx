import { SiteContactRow } from '@/components/sites/site-contact-row';
import { SiteContactAssignForm } from '@/components/sites/site-contact-assign-form';
import { partnerSettingsListPath } from '@/lib/partners/paths';
import type { TenantContactPerson } from '@/lib/types/database';

export type SiteContactAssignment = {
  linkId: string;
  contact: TenantContactPerson;
};

type Props = {
  siteId: string;
  assignments: SiteContactAssignment[];
  catalog: TenantContactPerson[];
  canEdit: boolean;
  canManagePartners: boolean;
};

export function SiteContactsSection({
  siteId,
  assignments,
  catalog,
  canEdit,
  canManagePartners,
}: Props) {
  const assignedIds = assignments.map((row) => row.contact.id);
  const stammdatenHref = partnerSettingsListPath('ansprechpartner');

  return (
    <section className="site-detail-section">
      <h2>Ansprechpartner</h2>
      <p className="muted">Kontakte aus den Stammdaten — Pflege unter Einstellungen → Stammdaten → Ansprechpartner.</p>

      {assignments.length > 0 ? (
        <ul className="site-entity-list">
          {assignments.map((row) => (
            <SiteContactRow key={row.linkId} linkId={row.linkId} contact={row.contact} canEdit={canEdit} />
          ))}
        </ul>
      ) : (
        <p className="muted">Noch keine Ansprechpartner zugeordnet.</p>
      )}

      {canEdit ? (
        <SiteContactAssignForm
          siteId={siteId}
          catalog={catalog}
          assignedIds={assignedIds}
          canManagePartners={canManagePartners}
          stammdatenHref={stammdatenHref}
        />
      ) : null}
    </section>
  );
}
