import { deleteSiteContact, updateSiteContact } from '@/lib/actions/admin';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

type Props = {
  siteId: string;
  contact: Contact;
  canEdit: boolean;
};

export function SiteContactRow({ siteId, contact, canEdit }: Props) {
  return (
    <li className="site-entity-row">
      <div className="site-entity-row-body">
        <strong>{contact.name}</strong>
        {contact.role && <span>{contact.role}</span>}
        <div className="site-entity-row-meta">
          {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
          {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
        </div>
        {canEdit && (
          <details className="site-entity-edit">
            <summary>Bearbeiten</summary>
            <form action={updateSiteContact} className="input-form site-entity-edit-form">
              <input type="hidden" name="id" value={contact.id} />
              <input type="hidden" name="site_id" value={siteId} />
              <label>Name<input name="name" defaultValue={contact.name} required /></label>
              <label>Rolle<input name="role" defaultValue={contact.role ?? ''} /></label>
              <label>Telefon<input name="phone" type="tel" defaultValue={contact.phone ?? ''} /></label>
              <label>E-Mail<input name="email" type="email" defaultValue={contact.email ?? ''} /></label>
              <button type="submit" className="primary-button primary-button--compact">Speichern</button>
            </form>
          </details>
        )}
      </div>
      {canEdit && (
        <SiteEntityDeleteButton
          id={contact.id}
          entityLabel="Ansprechpartner"
          onDelete={deleteSiteContact}
        />
      )}
    </li>
  );
}
