'use client';

import Link from 'next/link';
import { deleteSiteSupplier } from '@/lib/actions/admin';
import { updateSiteSupplierNotes } from '@/lib/actions/partners';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';
import { SiteSupplierAssignmentForm } from '@/components/sites/site-supplier-assignment-form';
import type { MasterPartnerCatalogEntry } from '@/lib/partners/catalog';
import { partnerContactLabel, partnerLocationAddress, partnerLocationLabel } from '@/lib/partners/labels';
import type { TenantBusinessPartnerContact, TenantBusinessPartnerLocation } from '@/lib/types/database';

type LinkedContact = Pick<TenantBusinessPartnerContact, 'id' | 'name' | 'role_title' | 'phone' | 'email'>;

type Supplier = {
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
  supplier: Supplier;
  catalogEntry: MasterPartnerCatalogEntry | null;
  canEdit: boolean;
};

export function SiteSupplierRow({ siteId, supplier, catalogEntry, canEdit }: Props) {
  const locationAddress = supplier.location ? partnerLocationAddress(supplier.location) : null;

  return (
    <li className="site-entity-row">
      <div className="site-entity-row-body">
        <strong>{supplier.name}</strong>
        {supplier.partner_id && (
          <span className="muted">
            {' '}
            ·{' '}
            <Link href="/app/einstellungen?tab=stammdaten&partners=lieferanten" className="table-action-link">
              Stammdaten
            </Link>
          </span>
        )}
        {supplier.location && (
          <span className="site-entity-row-meta-line">
            Standort: {partnerLocationLabel(supplier.location)}
            {locationAddress ? ` · ${locationAddress}` : ''}
          </span>
        )}
        {supplier.linkedContacts.length > 0 ? (
          <ul className="site-supplier-contact-list">
            {supplier.linkedContacts.map((contact) => (
              <li key={contact.id}>
                <span>{partnerContactLabel(contact)}</span>
                <span className="site-entity-row-meta">
                  {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
                  {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {supplier.contact_person && <span>{supplier.contact_person}</span>}
            <div className="site-entity-row-meta">
              {supplier.phone && <a href={`tel:${supplier.phone}`}>{supplier.phone}</a>}
              {supplier.email && <a href={`mailto:${supplier.email}`}>{supplier.email}</a>}
            </div>
          </>
        )}
        {supplier.notes && <p className="muted site-entity-notes">{supplier.notes}</p>}
        {canEdit && (
          <details className="site-entity-edit">
            <summary>Standort & Ansprechpartner</summary>
            {catalogEntry ? (
              <SiteSupplierAssignmentForm
                siteId={siteId}
                siteSupplierId={supplier.id}
                partnerId={supplier.partner_id!}
                initialLocationId={supplier.partner_location_id}
                initialContactIds={supplier.linkedContacts.map((row) => row.id)}
                catalogEntry={catalogEntry}
              />
            ) : (
              <p className="muted">Stammdaten des Lieferanten sind nicht verfügbar.</p>
            )}
          </details>
        )}
        {canEdit && (
          <details className="site-entity-edit">
            <summary>Baustellen-Bemerkung</summary>
            <form action={updateSiteSupplierNotes} className="input-form site-entity-edit-form">
              <input type="hidden" name="id" value={supplier.id} />
              <input type="hidden" name="site_id" value={siteId} />
              <label className="input-form-span-full">
                Bemerkung (nur diese Baustelle)
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
