'use client';

import Link from 'next/link';
import { assignSiteContactPersons } from '@/lib/actions/admin';
import type { TenantContactPerson } from '@/lib/types/database';

type Props = {
  siteId: string;
  catalog: TenantContactPerson[];
  assignedIds: string[];
  canManagePartners: boolean;
  stammdatenHref: string;
};

export function SiteContactAssignForm({
  siteId,
  catalog,
  assignedIds,
  canManagePartners,
  stammdatenHref,
}: Props) {
  const available = catalog.filter((person) => person.is_active && !assignedIds.includes(person.id));

  if (available.length === 0) {
    return (
      <p className="muted">
        {catalog.length === 0
          ? 'In den Stammdaten sind noch keine Ansprechpartner hinterlegt.'
          : 'Alle aktiven Ansprechpartner sind dieser Baustelle bereits zugeordnet.'}
        {canManagePartners ? (
          <>
            {' '}
            <Link href={stammdatenHref}>In Stammdaten anlegen</Link>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <form action={assignSiteContactPersons} className="input-form site-supplier-link-form">
      <input type="hidden" name="site_id" value={siteId} />
      <fieldset className="site-supplier-contact-picker">
        <legend>Ansprechpartner zuordnen</legend>
        <ul className="site-supplier-contact-options">
          {available.map((person) => (
            <li key={person.id}>
              <label className="input-form-checkbox">
                <input type="checkbox" name="contact_person_id[]" value={person.id} />
                <span>
                  {person.name}
                  {person.role_title ? ` · ${person.role_title}` : ''}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">
          Zuordnen
        </button>
        {canManagePartners ? (
          <Link href={stammdatenHref} className="secondary-button secondary-button--compact">
            In Stammdaten anlegen
          </Link>
        ) : null}
      </div>
    </form>
  );
}
