'use client';

import { useState } from 'react';
import {
  createPartnerContact,
  createPartnerLocation,
  setPartnerContactActive,
  setPartnerLocationActive,
  updatePartnerContact,
  updatePartnerLocation,
} from '@/lib/actions/partners';
import { partnerContactLabel, partnerLocationAddress, partnerLocationLabel } from '@/lib/partners/labels';
import type {
  BusinessPartnerKind,
  TenantBusinessPartnerContact,
  TenantBusinessPartnerLocation,
} from '@/lib/types/database';

type Props = {
  partnerId: string;
  kind: BusinessPartnerKind;
  locations: TenantBusinessPartnerLocation[];
  contacts: TenantBusinessPartnerContact[];
};

export function PartnerSubresourcesPanel({ partnerId, kind, locations, contacts }: Props) {
  const activeLocations = locations.filter((row) => row.is_active);
  const activeContacts = contacts.filter((row) => row.is_active);

  return (
    <div className="partner-subresources">
      <section className="partner-subresource-block">
        <h3 className="partner-subresource-title">Standorte</h3>
        {locations.length > 0 ? (
          <ul className="partner-subresource-list">
            {locations.map((location) => (
              <PartnerLocationItem key={location.id} location={location} partnerId={partnerId} kind={kind} />
            ))}
          </ul>
        ) : (
          <p className="muted partner-subresource-empty">Noch keine Standorte.</p>
        )}
        <PartnerLocationCreateForm partnerId={partnerId} kind={kind} />
      </section>

      <section className="partner-subresource-block">
        <h3 className="partner-subresource-title">Ansprechpartner</h3>
        {contacts.length > 0 ? (
          <ul className="partner-subresource-list">
            {contacts.map((contact) => (
              <PartnerContactItem
                key={contact.id}
                contact={contact}
                partnerId={partnerId}
                kind={kind}
                locations={activeLocations}
              />
            ))}
          </ul>
        ) : (
          <p className="muted partner-subresource-empty">Noch keine Ansprechpartner.</p>
        )}
        <PartnerContactCreateForm partnerId={partnerId} kind={kind} locations={activeLocations} />
      </section>
    </div>
  );
}

function PartnerLocationItem({
  location,
  partnerId,
  kind,
}: {
  location: TenantBusinessPartnerLocation;
  partnerId: string;
  kind: BusinessPartnerKind;
}) {
  const [editing, setEditing] = useState(false);
  const address = partnerLocationAddress(location);

  return (
    <li className={`partner-subresource-item${location.is_active ? '' : ' partner-subresource-item--inactive'}`}>
      <div className="partner-subresource-item-main">
        <strong>{partnerLocationLabel(location)}</strong>
        {address && <span className="muted">{address}</span>}
        {location.phone && <a href={`tel:${location.phone}`}>{location.phone}</a>}
      </div>
      <div className="partner-subresource-item-actions inline-actions">
        <button type="button" className="table-action-link" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Schließen' : 'Bearbeiten'}
        </button>
        <form action={setPartnerLocationActive}>
          <input type="hidden" name="id" value={location.id} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="is_active" value={location.is_active ? 'false' : 'true'} />
          <button
            type="submit"
            className={`table-action-link${location.is_active ? ' table-action-link--danger' : ''}`}
          >
            {location.is_active ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </form>
      </div>
      {editing && (
        <form action={updatePartnerLocation} className="input-form partner-subresource-form">
          <input type="hidden" name="id" value={location.id} />
          <input type="hidden" name="partner_id" value={partnerId} />
          <input type="hidden" name="kind" value={kind} />
          <div className="input-form-core input-form-core--grid">
            <label>Bezeichnung<input name="label" defaultValue={location.label} required /></label>
            <label>Straße<input name="street" defaultValue={location.street ?? ''} /></label>
            <label>PLZ<input name="postal_code" defaultValue={location.postal_code ?? ''} /></label>
            <label>Ort<input name="city" defaultValue={location.city ?? ''} /></label>
            <label>Telefon<input name="phone" type="tel" defaultValue={location.phone ?? ''} /></label>
            <label className="input-form-span-full">
              Notiz
              <textarea name="notes" rows={2} defaultValue={location.notes ?? ''} />
            </label>
          </div>
          <button type="submit" className="primary-button primary-button--compact">Speichern</button>
        </form>
      )}
    </li>
  );
}

function PartnerLocationCreateForm({ partnerId, kind }: { partnerId: string; kind: BusinessPartnerKind }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="secondary-button secondary-button--compact" onClick={() => setOpen(true)}>
        Standort hinzufügen
      </button>
    );
  }
  return (
    <form action={createPartnerLocation} className="input-form partner-subresource-form">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="input-form-core input-form-core--grid">
        <label>Bezeichnung<input name="label" required placeholder="z. B. Werk Nord" /></label>
        <label>Straße<input name="street" /></label>
        <label>PLZ<input name="postal_code" /></label>
        <label>Ort<input name="city" /></label>
        <label>Telefon<input name="phone" type="tel" /></label>
        <label className="input-form-span-full">
          Notiz
          <textarea name="notes" rows={2} />
        </label>
      </div>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">Standort anlegen</button>
        <button type="button" className="secondary-button secondary-button--compact" onClick={() => setOpen(false)}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function PartnerContactItem({
  contact,
  partnerId,
  kind,
  locations,
}: {
  contact: TenantBusinessPartnerContact;
  partnerId: string;
  kind: BusinessPartnerKind;
  locations: TenantBusinessPartnerLocation[];
}) {
  const [editing, setEditing] = useState(false);
  const locationLabel = locations.find((row) => row.id === contact.location_id);

  return (
    <li className={`partner-subresource-item${contact.is_active ? '' : ' partner-subresource-item--inactive'}`}>
      <div className="partner-subresource-item-main">
        <strong>{partnerContactLabel(contact)}</strong>
        {locationLabel && <span className="muted">Standort: {partnerLocationLabel(locationLabel)}</span>}
        {!locationLabel && contact.location_id == null && (
          <span className="muted">Standort: alle / nicht zugeordnet</span>
        )}
        <div className="partner-subresource-contact-meta">
          {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
          {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
        </div>
      </div>
      <div className="partner-subresource-item-actions inline-actions">
        <button type="button" className="table-action-link" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Schließen' : 'Bearbeiten'}
        </button>
        <form action={setPartnerContactActive}>
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="is_active" value={contact.is_active ? 'false' : 'true'} />
          <button
            type="submit"
            className={`table-action-link${contact.is_active ? ' table-action-link--danger' : ''}`}
          >
            {contact.is_active ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </form>
      </div>
      {editing && (
        <form action={updatePartnerContact} className="input-form partner-subresource-form">
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="partner_id" value={partnerId} />
          <input type="hidden" name="kind" value={kind} />
          <div className="input-form-core input-form-core--grid">
            <label>Name<input name="name" defaultValue={contact.name} required /></label>
            <label>Funktion<input name="role_title" defaultValue={contact.role_title ?? ''} /></label>
            <label>Telefon<input name="phone" type="tel" defaultValue={contact.phone ?? ''} /></label>
            <label>E-Mail<input name="email" type="email" defaultValue={contact.email ?? ''} /></label>
            <label>
              Standort (optional)
              <select name="location_id" defaultValue={contact.location_id ?? ''}>
                <option value="">— nicht zugeordnet —</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {partnerLocationLabel(location)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="primary-button primary-button--compact">Speichern</button>
        </form>
      )}
    </li>
  );
}

function PartnerContactCreateForm({
  partnerId,
  kind,
  locations,
}: {
  partnerId: string;
  kind: BusinessPartnerKind;
  locations: TenantBusinessPartnerLocation[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="secondary-button secondary-button--compact" onClick={() => setOpen(true)}>
        Ansprechpartner hinzufügen
      </button>
    );
  }
  return (
    <form action={createPartnerContact} className="input-form partner-subresource-form">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="input-form-core input-form-core--grid">
        <label>Name<input name="name" required /></label>
        <label>Funktion<input name="role_title" /></label>
        <label>Telefon<input name="phone" type="tel" /></label>
        <label>E-Mail<input name="email" type="email" /></label>
        <label>
          Standort (optional)
          <select name="location_id" defaultValue="">
            <option value="">— nicht zugeordnet —</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {partnerLocationLabel(location)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">Ansprechpartner anlegen</button>
        <button type="button" className="secondary-button secondary-button--compact" onClick={() => setOpen(false)}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
