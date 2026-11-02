'use client';

import { useEffect, useMemo, useState } from 'react';
import { assignSiteContactPersons } from '@/lib/actions/admin';
import { TenantContactPersonCreateDialog } from '@/components/contacts/tenant-contact-person-create-dialog';
import { AppDialog } from '@/components/ui/app-dialogs';
import type { TenantContactPerson } from '@/lib/types/database';

type Props = {
  siteId: string;
  catalog: TenantContactPerson[];
  assignedIds: string[];
  canManagePartners: boolean;
  resetKey: number;
};

function contactLine(person: TenantContactPerson): string {
  return person.role_title ? `${person.name} · ${person.role_title}` : person.name;
}

export function SiteContactAssignDialog({
  siteId,
  catalog,
  assignedIds,
  canManagePartners,
  resetKey,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  const available = useMemo(() => {
    return catalog
      .filter((person) => person.is_active && !assignedIds.includes(person.id))
      .sort((a, b) => contactLine(a).localeCompare(contactLine(b), 'de', { sensitivity: 'base' }));
  }, [catalog, assignedIds]);

  if (available.length === 0) {
    return (
      <p className="muted site-detail-assign-form__hint" style={{ marginTop: 16 }}>
        {catalog.length === 0
          ? 'In den Stammdaten sind noch keine Ansprechpartner hinterlegt.'
          : 'Alle aktiven Ansprechpartner sind dieser Baustelle bereits zugeordnet.'}
        {canManagePartners ? (
          <>
            {' '}
            <TenantContactPersonCreateDialog siteId={siteId} />
          </>
        ) : null}
      </p>
    );
  }

  return (
    <>
      <div className="site-team-add-trigger">
        <button type="button" className="secondary-button secondary-button--compact" onClick={() => setOpen(true)}>
          Ansprechpartner hinzufügen
        </button>
      </div>
      {canManagePartners ? (
        <p className="muted site-detail-assign-form__hint">
          <TenantContactPersonCreateDialog siteId={siteId} />
        </p>
      ) : null}
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ansprechpartner hinzufügen"
        footer={
          open ? (
            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button type="submit" form="site-contact-assign-form" className="primary-button primary-button--compact">
                Hinzufügen
              </button>
            </div>
          ) : null
        }
      >
        {open ? (
          <form id="site-contact-assign-form" action={assignSiteContactPersons} className="input-form site-team-add-form">
            <input type="hidden" name="site_id" value={siteId} />
            <p className="muted site-team-add-form-lead">
              Mehrere Ansprechpartner auswählen, dann Hinzufügen.
              {canManagePartners ? (
                <>
                  {' '}
                  <TenantContactPersonCreateDialog siteId={siteId} />
                </>
              ) : null}
            </p>
            <ul className="site-team-picker-list">
              {available.map((person) => (
                <li key={person.id}>
                  <label className="input-form-checkbox site-team-picker-option">
                    <input type="checkbox" name="contact_person_id[]" value={person.id} />
                    <span>{contactLine(person)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </form>
        ) : null}
      </AppDialog>
    </>
  );
}
