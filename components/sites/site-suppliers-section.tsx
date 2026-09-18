import { deleteSiteSupplier, saveSiteSuppliers } from '@/lib/actions/admin';
import { DynamicFormRows } from '@/components/ui/dynamic-form-rows';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
};

type Props = {
  siteId: string;
  suppliers: Supplier[];
  canEdit: boolean;
};

const SUPPLIER_FIELDS = [
  { name: 'name[]', label: 'Firma', required: true },
  { name: 'contact_person[]', label: 'Ansprechpartner' },
  { name: 'phone[]', label: 'Telefon', type: 'tel' },
  { name: 'email[]', label: 'E-Mail', type: 'email' },
];

export function SiteSuppliersSection({ siteId, suppliers, canEdit }: Props) {
  return (
    <section className="site-detail-section">
      <h2>Lieferanten</h2>

      {suppliers.length > 0 ? (
        <ul className="site-entity-list">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="site-entity-row">
              <div className="site-entity-row-body">
                <strong>{supplier.name}</strong>
                {supplier.contact_person && <span>{supplier.contact_person}</span>}
                <div className="site-entity-row-meta">
                  {supplier.phone && <a href={`tel:${supplier.phone}`}>{supplier.phone}</a>}
                  {supplier.email && <a href={`mailto:${supplier.email}`}>{supplier.email}</a>}
                </div>
              </div>
              {canEdit && (
                <SiteEntityDeleteButton
                  id={supplier.id}
                  entityLabel="Lieferant"
                  onDelete={deleteSiteSupplier}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Noch keine Lieferanten erfasst.</p>
      )}

      {canEdit && (
        <form action={saveSiteSuppliers} className="input-form">
          <input type="hidden" name="site_id" value={siteId} />
          <DynamicFormRows fields={SUPPLIER_FIELDS} />
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Lieferant speichern</button>
          </div>
        </form>
      )}
    </section>
  );
}
