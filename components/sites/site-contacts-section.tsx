import { saveSiteContacts } from '@/lib/actions/admin';
import { SiteContactRow } from '@/components/sites/site-contact-row';
import { DynamicFormRows } from '@/components/ui/dynamic-form-rows';

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
            <SiteContactRow key={contact.id} siteId={siteId} contact={contact} canEdit={canEdit} />
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
