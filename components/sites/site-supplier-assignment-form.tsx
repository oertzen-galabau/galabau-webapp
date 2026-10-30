'use client';

import { useMemo, useState } from 'react';
import { updateSiteSupplierAssignment } from '@/lib/actions/partners';
import { contactsForPartnerSelection, type MasterPartnerCatalogEntry } from '@/lib/partners/catalog';
import { partnerContactLabel, partnerLocationLabel } from '@/lib/partners/labels';

type Props = {
  siteId: string;
  siteSupplierId: string;
  partnerId: string;
  initialLocationId: string | null;
  initialContactIds: string[];
  catalogEntry: MasterPartnerCatalogEntry;
};

export function SiteSupplierAssignmentForm({
  siteId,
  siteSupplierId,
  partnerId,
  initialLocationId,
  initialContactIds,
  catalogEntry,
}: Props) {
  const [locationId, setLocationId] = useState(initialLocationId ?? '');

  const locations = useMemo(
    () => catalogEntry.locations.filter((row) => row.is_active),
    [catalogEntry.locations],
  );
  const contacts = useMemo(
    () => contactsForPartnerSelection(catalogEntry.contacts, locationId || null),
    [catalogEntry.contacts, locationId],
  );

  return (
    <form action={updateSiteSupplierAssignment} className="input-form site-entity-edit-form">
      <input type="hidden" name="id" value={siteSupplierId} />
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="partner_id" value={partnerId} />

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

      {contacts.length > 0 && (
        <fieldset className="site-supplier-contact-picker">
          <legend>Ansprechpartner</legend>
          <ul className="site-supplier-contact-options">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <label className="input-form-checkbox">
                  <input
                    type="checkbox"
                    name="partner_contact_id[]"
                    value={contact.id}
                    defaultChecked={initialContactIds.includes(contact.id)}
                  />
                  <span>{partnerContactLabel(contact)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <button type="submit" className="primary-button primary-button--compact">Zuordnung speichern</button>
    </form>
  );
}
