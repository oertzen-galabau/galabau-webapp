'use client';

import { useState } from 'react';
import {
  deleteTenantContactPerson,
  setTenantContactPersonActive,
  updateTenantContactPerson,
} from '@/lib/actions/partners';
import type { TenantContactPerson } from '@/lib/types/database';

type Props = {
  person: TenantContactPerson;
  canManage: boolean;
};

export function TenantContactPersonRow({ person, canManage }: Props) {
  const [editing, setEditing] = useState(false);
  const colCount = canManage ? 4 : 3;

  return (
    <>
      <tr
        className={`data-table-row partner-table-row${person.is_active ? '' : ' partner-table-row--inactive'}`}
      >
        <td className="partner-table-name">
          <strong>{person.name}</strong>
          {person.role_title ? <small className="partner-table-summary">{person.role_title}</small> : null}
        </td>
        <td className="partner-table-contact">
          {person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : null}
          {person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : null}
          {!person.phone && !person.email ? <span className="muted">—</span> : null}
        </td>
        <td className="partner-table-status">
          <span className={`status-badge${person.is_active ? ' active' : ''}`}>
            {person.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </td>
        {canManage ? (
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
              <form action={setTenantContactPersonActive}>
                <input type="hidden" name="id" value={person.id} />
                <input type="hidden" name="is_active" value={person.is_active ? 'false' : 'true'} />
                <button
                  type="submit"
                  className={`table-action-link${person.is_active ? ' table-action-link--danger' : ''}`}
                >
                  {person.is_active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </form>
              <form action={deleteTenantContactPerson}>
                <input type="hidden" name="id" value={person.id} />
                <button type="submit" className="table-action-link table-action-link--danger">
                  Löschen
                </button>
              </form>
            </div>
          </td>
        ) : null}
      </tr>
      {canManage && editing ? (
        <tr className="partner-table-edit-row">
          <td colSpan={colCount}>
            <form
              action={async (formData) => {
                await updateTenantContactPerson(formData);
                setEditing(false);
              }}
              className="input-form partner-table-edit-form"
            >
              <input type="hidden" name="id" value={person.id} />
              <div className="input-form-core input-form-core--grid">
                <label>
                  Name
                  <input name="name" defaultValue={person.name} required />
                </label>
                <label>
                  Rolle
                  <input name="role_title" defaultValue={person.role_title ?? ''} />
                </label>
                <label>
                  Telefon
                  <input name="phone" type="tel" defaultValue={person.phone ?? ''} />
                </label>
                <label>
                  E-Mail
                  <input name="email" type="email" defaultValue={person.email ?? ''} />
                </label>
              </div>
              <div className="input-form-actions">
                <button type="submit" className="primary-button primary-button--compact">
                  Speichern
                </button>
              </div>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
