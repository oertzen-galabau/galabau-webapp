'use client';

import { useMemo, useState } from 'react';
import { linkSiteSupplier } from '@/lib/actions/partners';
import {
  contactsForPartnerSelection,
  type MasterPartnerCatalogEntry,
  siteSupplierLinkKey,
} from '@/lib/partners/catalog';
import { partnerContactLabel, partnerLocationLabel } from '@/lib/partners/labels';

type Props = {
  siteId: string;
  catalog: MasterPartnerCatalogEntry[];
  linkedKeys: string[];
};

export function SiteSupplierLinkForm({ siteId, catalog, linkedKeys }: Props) {
  const [partnerId, setPartnerId] = useState('');
  const [locationId, setLocationId] = useState('');

  const partner = useMemo(() => catalog.find((row) => row.id === partnerId), [catalog, partnerId]);
  const locations = useMemo(
    () => (partner?.locations ?? []).filter((row) => row.is_active),
    [partner],
  );
  const contacts = useMemo(
    () => contactsForPartnerSelection(partner?.contacts ?? [], locationId || null),
    [partner, locationId],
  );

  const linkKey = partnerId ? siteSupplierLinkKey(partnerId, locationId || null) : '';
  const alreadyLinked = linkedKeys.includes(linkKey);

  function onPartnerChange(nextPartnerId: string) {
    setPartnerId(nextPartnerId);
    setLocationId('');
  }

  return (
    <form action={linkSiteSupplier} className="input-form site-supplier-link-form">
      <input type="hidden" name="site_id" value={siteId} />
      <label>
        Lieferant aus Stammliste
        <select name="partner_id" required value={partnerId} onChange={(e) => onPartnerChange(e.target.value)}>
          <option value="" disabled>
            — wählen —
          </option>
          {catalog.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>

      {partner && (
        <>
          <label>
            Standort (optional)
            <select
              name="partner_location_id"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">— kein Standort —</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {partnerLocationLabel(location)}
                </option>
              ))}
            </select>
          </label>

          {contacts.length > 0 ? (
            <fieldset className="site-supplier-contact-picker">
              <legend>Ansprechpartner (optional, mehrere möglich)</legend>
              <ul className="site-supplier-contact-options">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <label className="input-form-checkbox">
                      <input type="checkbox" name="partner_contact_id[]" value={contact.id} />
                      <span>{partnerContactLabel(contact)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : (
            <p className="muted">Für diesen Lieferanten sind keine Ansprechpartner hinterlegt.</p>
          )}
        </>
      )}

      {alreadyLinked && partner && (
        <p className="muted">Diese Kombination aus Lieferant und Standort ist bereits zugeordnet.</p>
      )}

      <div className="input-form-actions">
        <button
          type="submit"
          className="primary-button primary-button--compact"
          disabled={!partnerId || alreadyLinked}
        >
          Lieferant zuordnen
        </button>
      </div>
    </form>
  );
}
