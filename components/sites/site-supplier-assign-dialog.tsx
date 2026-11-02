'use client';

import { useEffect, useMemo, useState } from 'react';
import { linkSiteSuppliers } from '@/lib/actions/partners';
import { PartnerSupplierCreateDialog } from '@/components/partners/partner-supplier-create-dialog';
import { AppDialog } from '@/components/ui/app-dialogs';
import {
  buildAvailableSiteSupplierLinks,
  type MasterPartnerCatalogEntry,
} from '@/lib/partners/catalog';

type Props = {
  siteId: string;
  catalog: MasterPartnerCatalogEntry[];
  linkedKeys: string[];
  canManagePartners: boolean;
  resetKey: number;
};

function emptyDialogMessage(
  catalog: MasterPartnerCatalogEntry[],
  canManagePartners: boolean,
): string {
  if (catalog.length === 0) {
    return canManagePartners
      ? 'In den Stammdaten sind noch keine Lieferanten hinterlegt.'
      : 'In den Stammdaten sind noch keine Lieferanten hinterlegt. Bitte die Verwaltung, Lieferanten anzulegen.';
  }
  return 'Alle Lieferanten aus den Stammdaten sind dieser Baustelle bereits zugeordnet.';
}

export function SiteSupplierAssignDialog({
  siteId,
  catalog,
  linkedKeys,
  canManagePartners,
  resetKey,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  const available = useMemo(
    () => buildAvailableSiteSupplierLinks(catalog, linkedKeys),
    [catalog, linkedKeys],
  );

  const hasChoices = available.length > 0;

  return (
    <>
      <div className="site-team-add-trigger">
        <button type="button" className="secondary-button secondary-button--compact" onClick={() => setOpen(true)}>
          Lieferant hinzufügen
        </button>
      </div>
      {canManagePartners ? (
        <p className="muted site-detail-assign-form__hint">
          <PartnerSupplierCreateDialog siteId={siteId} />
        </p>
      ) : null}
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Lieferant hinzufügen"
        footer={
          open ? (
            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button
                type="submit"
                form="site-supplier-assign-form"
                className="primary-button primary-button--compact"
                disabled={!hasChoices}
              >
                Hinzufügen
              </button>
            </div>
          ) : null
        }
      >
        {open ? (
          <form id="site-supplier-assign-form" action={linkSiteSuppliers} className="input-form site-team-add-form">
            <input type="hidden" name="site_id" value={siteId} />
            {hasChoices ? (
              <>
                <p className="muted site-team-add-form-lead">
                  Mehrere Lieferanten auswählen, dann Hinzufügen. Standorte erscheinen als eigene Zeilen.
                  {canManagePartners ? (
                    <>
                      {' '}
                      <PartnerSupplierCreateDialog siteId={siteId} />
                    </>
                  ) : null}
                </p>
                <ul className="site-team-picker-list">
                  {available.map((option) => (
                    <li key={option.value}>
                      <label className="input-form-checkbox site-team-picker-option">
                        <input type="checkbox" name="supplier_link[]" value={option.value} />
                        <span>{option.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted site-team-add-form-lead">
                {emptyDialogMessage(catalog, canManagePartners)}
                {canManagePartners ? (
                  <>
                    {' '}
                    <PartnerSupplierCreateDialog siteId={siteId} />
                  </>
                ) : null}
              </p>
            )}
          </form>
        ) : null}
      </AppDialog>
    </>
  );
}
