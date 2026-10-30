import { unlinkSiteContactPerson } from '@/lib/actions/admin';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';
import type { TenantContactPerson } from '@/lib/types/database';

type Props = {
  linkId: string;
  contact: TenantContactPerson;
  canEdit: boolean;
};

export function SiteContactRow({ linkId, contact, canEdit }: Props) {
  return (
    <li className="site-entity-row">
      <div className="site-entity-row-body">
        <strong>{contact.name}</strong>
        {contact.role_title ? <span>{contact.role_title}</span> : null}
        <div className="site-entity-row-meta">
          {contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : null}
          {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
        </div>
      </div>
      {canEdit ? (
        <SiteEntityDeleteButton
          id={linkId}
          entityLabel="Zuordnung"
          onDelete={unlinkSiteContactPerson}
        />
      ) : null}
    </li>
  );
}
