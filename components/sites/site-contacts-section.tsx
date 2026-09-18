import { deleteSiteContact, saveSiteContacts } from '@/lib/actions/admin';
import { DynamicFormRows } from '@/components/ui/dynamic-form-rows';
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
  contacts: Contact[];
  canEdit: boolean;
};

const CONTACT_FIELDS = [
  { name: 'name[]', label: 'Name', required: true },
  { name: 'role[]', label: 'Rolle', placeholder: 'z.B. Bauleiter' },
  { name: 'phone[]', label: 'Telefon', type: 'tel' },
  { name: 'email[]', label: 'E-Mail', type: 'email' },
];

export function SiteContactsSection({ siteId, contacts, canEdit }: Props) {
  return (
    <section className="site-detail-section">
      <h2>Ansprechpartner</h2>

      {contacts.length > 0 ? (
        <ul className="site-entity-list">
          {contacts.map((contact) => (
            <li key={contact.id} className="site-entity-row">
              <div className="site-entity-row-body">
                <strong>{contact.name}</strong>
                {contact.role && <span>{contact.role}</span>}
                <div className="site-entity-row-meta">
                  {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
                  {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                </div>
              </div>
              {canEdit && (
                <SiteEntityDeleteButton
                  id={contact.id}
                  entityLabel="Ansprechpartner"
                  onDelete={deleteSiteContact}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Noch keine Ansprechpartner erfasst.</p>
      )}

      {canEdit && (
        <form action={saveSiteContacts} className="input-form">
          <input type="hidden" name="site_id" value={siteId} />
          <DynamicFormRows fields={CONTACT_FIELDS} />
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Ansprechpartner speichern</button>
          </div>
        </form>
      )}
    </section>
  );
}
