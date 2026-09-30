import { deleteSiteSupplier, updateSiteSupplier } from '@/lib/actions/admin';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type Props = {
  siteId: string;
  supplier: Supplier;
  canEdit: boolean;
};

export function SiteSupplierRow({ siteId, supplier, canEdit }: Props) {
  return (
    <li className="site-entity-row">
      <div className="site-entity-row-body">
        <strong>{supplier.name}</strong>
        {supplier.contact_person && <span>{supplier.contact_person}</span>}
        {supplier.notes && <p className="muted site-entity-notes">{supplier.notes}</p>}
        <div className="site-entity-row-meta">
          {supplier.phone && <a href={`tel:${supplier.phone}`}>{supplier.phone}</a>}
          {supplier.email && <a href={`mailto:${supplier.email}`}>{supplier.email}</a>}
        </div>
        {canEdit && (
          <details className="site-entity-edit">
            <summary>Bearbeiten</summary>
            <form action={updateSiteSupplier} className="input-form site-entity-edit-form">
              <input type="hidden" name="id" value={supplier.id} />
              <input type="hidden" name="site_id" value={siteId} />
              <label>Firma<input name="name" defaultValue={supplier.name} required /></label>
              <label>Ansprechpartner<input name="contact_person" defaultValue={supplier.contact_person ?? ''} /></label>
              <label>Telefon<input name="phone" type="tel" defaultValue={supplier.phone ?? ''} /></label>
              <label>E-Mail<input name="email" type="email" defaultValue={supplier.email ?? ''} /></label>
              <label className="input-form-span-full">
                Bemerkung
                <textarea name="notes" rows={4} defaultValue={supplier.notes ?? ''} />
              </label>
              <button type="submit" className="primary-button primary-button--compact">Speichern</button>
            </form>
          </details>
        )}
      </div>
      {canEdit && (
        <SiteEntityDeleteButton
          id={supplier.id}
          entityLabel="Lieferant"
          onDelete={deleteSiteSupplier}
        />
      )}
    </li>
  );
}
