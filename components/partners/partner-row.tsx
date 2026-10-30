'use client';

import { useState } from 'react';
import { PartnerSubresourcesPanel } from '@/components/partners/partner-subresources-panel';
import { setPartnerActive, updatePartner } from '@/lib/actions/partners';
import { partnerContactLabel } from '@/lib/partners/labels';
import type {
  TenantBusinessPartner,
  TenantBusinessPartnerContact,
  TenantBusinessPartnerLocation,
} from '@/lib/types/database';

type Props = {
  partner: TenantBusinessPartner;
  locations: TenantBusinessPartnerLocation[];
  contacts: TenantBusinessPartnerContact[];
  canManage: boolean;
};

export function PartnerRow({ partner, locations, contacts, canManage }: Props) {
  const [editing, setEditing] = useState(false);
  const colCount = canManage ? 5 : 4;
  const activeLocations = locations.filter((row) => row.is_active).length;
  const activeContacts = contacts.filter((row) => row.is_active);
  const primaryContact = activeContacts[0];

  return (
    <>
      <tr className={`data-table-row partner-table-row${partner.is_active ? '' : ' partner-table-row--inactive'}`}>
        <td className="partner-table-name">
          <strong>{partner.name}</strong>
          <small className="partner-table-summary">
            {activeLocations} Standort{activeLocations === 1 ? '' : 'e'} · {activeContacts.length} Ansprechpartner
          </small>
        </td>
        <td className="partner-table-contact">
          {primaryContact ? (
            <>
              <span>{partnerContactLabel(primaryContact)}</span>
              {primaryContact.phone && <a href={`tel:${primaryContact.phone}`}>{primaryContact.phone}</a>}
              {primaryContact.email && <a href={`mailto:${primaryContact.email}`}>{primaryContact.email}</a>}
            </>
          ) : (
            <>
              {partner.phone && <a href={`tel:${partner.phone}`}>{partner.phone}</a>}
              {partner.email && <a href={`mailto:${partner.email}`}>{partner.email}</a>}
              {!partner.phone && !partner.email && <span className="muted">—</span>}
            </>
          )}
        </td>
        <td className="partner-table-notes data-table-col--optional">
          {partner.notes ? <span title={partner.notes}>{partner.notes}</span> : <span className="muted">—</span>}
        </td>
        <td className="partner-table-status">
          <span className={`status-badge${partner.is_active ? ' active' : ''}`}>
            {partner.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </td>
        {canManage && (
          <td className="data-table-actions partner-table-actions">
            <div className="inline-actions">
              <button
                type="button"
                className="table-action-link"
                aria-expanded={editing}
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? 'Schließen' : 'Bearbeiten'}
              </button>
              <form action={setPartnerActive}>
                <input type="hidden" name="id" value={partner.id} />
                <input type="hidden" name="kind" value={partner.kind} />
                <input type="hidden" name="is_active" value={partner.is_active ? 'false' : 'true'} />
                <button
                  type="submit"
                  className={`table-action-link${partner.is_active ? ' table-action-link--danger' : ''}`}
                >
                  {partner.is_active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </form>
            </div>
          </td>
        )}
      </tr>
      {canManage && editing && (
        <tr className="partner-table-edit-row">
          <td colSpan={colCount}>
            <form
              action={async (formData) => {
                await updatePartner(formData);
                setEditing(false);
              }}
              className="input-form partner-table-edit-form"
            >
              <input type="hidden" name="id" value={partner.id} />
              <input type="hidden" name="kind" value={partner.kind} />
              <div className="input-form-core input-form-core--grid">
                <label>Firma<input name="name" defaultValue={partner.name} required /></label>
                <label>Ansprechpartner<input name="contact_person" defaultValue={partner.contact_person ?? ''} /></label>
                <label>Telefon<input name="phone" type="tel" defaultValue={partner.phone ?? ''} /></label>
                <label>E-Mail<input name="email" type="email" defaultValue={partner.email ?? ''} /></label>
                <label className="input-form-span-full">
                  Bemerkung
                  <textarea name="notes" rows={3} defaultValue={partner.notes ?? ''} />
                </label>
              </div>
              <div className="input-form-actions">
                <button type="submit" className="primary-button primary-button--compact">Stammdaten speichern</button>
                <button type="button" className="secondary-button secondary-button--compact" onClick={() => setEditing(false)}>
                  Abbrechen
                </button>
              </div>
            </form>
            <PartnerSubresourcesPanel
              partnerId={partner.id}
              kind={partner.kind}
              locations={locations}
              contacts={contacts}
            />
          </td>
        </tr>
      )}
    </>
  );
}
