import Link from 'next/link';
import { SiteSupplierLinkForm } from '@/components/sites/site-supplier-link-form';
import { SiteSupplierRow } from '@/components/sites/site-supplier-row';
import { siteSupplierLinkKey, type MasterPartnerCatalogEntry } from '@/lib/partners/catalog';
import type { TenantBusinessPartnerContact, TenantBusinessPartnerLocation } from '@/lib/types/database';

type LinkedContact = Pick<TenantBusinessPartnerContact, 'id' | 'name' | 'role_title' | 'phone' | 'email'>;

type SiteSupplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  partner_id: string | null;
  partner_location_id: string | null;
  location: Pick<TenantBusinessPartnerLocation, 'id' | 'label' | 'street' | 'postal_code' | 'city' | 'phone'> | null;
  linkedContacts: LinkedContact[];
};

type Props = {
  siteId: string;
  suppliers: SiteSupplier[];
  partnerCatalog: MasterPartnerCatalogEntry[];
  canEdit: boolean;
  canManagePartners: boolean;
};

export function SiteSuppliersSection({
  siteId,
  suppliers,
  partnerCatalog,
  canEdit,
  canManagePartners,
}: Props) {
  const catalogByPartnerId = new Map(partnerCatalog.map((entry) => [entry.id, entry]));
  const linkedKeys = suppliers
    .filter((row) => row.partner_id)
    .map((row) => siteSupplierLinkKey(row.partner_id!, row.partner_location_id));

  return (
    <section className="site-detail-section">
      <h2>Lieferanten</h2>

      {suppliers.length > 0 ? (
        <ul className="site-entity-list">
          {suppliers.map((supplier) => (
            <SiteSupplierRow
              key={supplier.id}
              siteId={siteId}
              supplier={supplier}
              catalogEntry={supplier.partner_id ? catalogByPartnerId.get(supplier.partner_id) ?? null : null}
              canEdit={canEdit}
            />
          ))}
        </ul>
      ) : (
        <p className="muted">Noch keine Lieferanten dieser Baustelle zugeordnet.</p>
      )}

      {canEdit && partnerCatalog.length > 0 && (
        <SiteSupplierLinkForm siteId={siteId} catalog={partnerCatalog} linkedKeys={linkedKeys} />
      )}

      {canEdit && partnerCatalog.length === 0 && (
        <p className="muted">
          {canManagePartners ? (
            <>
              Zuerst Lieferanten in der{' '}
              <Link href="/app/einstellungen?tab=stammdaten&partners=lieferanten">Stammdatenliste</Link> anlegen.
            </>
          ) : (
            'Bitte die Verwaltung, Lieferanten in den Stammdaten anzulegen.'
          )}
        </p>
      )}
    </section>
  );
}
