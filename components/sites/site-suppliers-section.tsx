import { saveSiteSuppliers } from '@/lib/actions/admin';
import { SiteSupplierRow } from '@/components/sites/site-supplier-row';
import { DynamicFormRows } from '@/components/ui/dynamic-form-rows';

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
  suppliers: Supplier[];
  canEdit: boolean;
};

const SUPPLIER_FIELDS = [
  { name: 'name[]', label: 'Firma', required: true },
  { name: 'contact_person[]', label: 'Ansprechpartner' },
  { name: 'phone[]', label: 'Telefon', type: 'tel' },
  { name: 'email[]', label: 'E-Mail', type: 'email' },
  { name: 'notes[]', label: 'Bemerkung', className: 'input-form-span-full' },
];

export function SiteSuppliersSection({ siteId, suppliers, canEdit }: Props) {
  return (
    <section className="site-detail-section">
      <h2>Lieferanten</h2>

      {suppliers.length > 0 ? (
        <ul className="site-entity-list">
          {suppliers.map((supplier) => (
            <SiteSupplierRow key={supplier.id} siteId={siteId} supplier={supplier} canEdit={canEdit} />
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
