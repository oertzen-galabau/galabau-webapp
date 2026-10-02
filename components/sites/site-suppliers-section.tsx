import Link from 'next/link';
import { linkSiteSupplier } from '@/lib/actions/partners';
import { SiteSupplierRow } from '@/components/sites/site-supplier-row';
import { partnerOptionLabel } from '@/lib/partners/kind';

type SiteSupplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  partner_id: string | null;
};

type MasterSupplier = {
  id: string;
  name: string;
  contact_person: string | null;
};

type Props = {
  siteId: string;
  suppliers: SiteSupplier[];
  masterSuppliers: MasterSupplier[];
  canEdit: boolean;
  canManagePartners: boolean;
};

export function SiteSuppliersSection({
  siteId,
  suppliers,
  masterSuppliers,
  canEdit,
  canManagePartners,
}: Props) {
  const linkedPartnerIds = new Set(
    suppliers.map((s) => s.partner_id).filter((id): id is string => Boolean(id)),
  );
  const availableToLink = masterSuppliers.filter((p) => !linkedPartnerIds.has(p.id));

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
        <p className="muted">Noch keine Lieferanten dieser Baustelle zugeordnet.</p>
      )}

      {canEdit && availableToLink.length > 0 && (
        <form action={linkSiteSupplier} className="input-form">
          <input type="hidden" name="site_id" value={siteId} />
          <label>
            Lieferant aus Stammliste
            <select name="partner_id" required defaultValue="">
              <option value="" disabled>— wählen —</option>
              {availableToLink.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partnerOptionLabel(partner)}
                </option>
              ))}
            </select>
          </label>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Lieferant zuordnen</button>
          </div>
        </form>
      )}

      {canEdit && availableToLink.length === 0 && masterSuppliers.length === 0 && (
        <p className="muted">
          {canManagePartners ? (
            <>
              Zuerst Lieferanten in der{' '}
              <Link href="/app/geschaeftspartner?tab=lieferanten">Stammdatenliste</Link> anlegen.
            </>
          ) : (
            'Bitte die Verwaltung, Lieferanten in den Stammdaten anzulegen.'
          )}
        </p>
      )}
    </section>
  );
}
