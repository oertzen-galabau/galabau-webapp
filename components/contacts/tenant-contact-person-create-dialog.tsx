'use client';

import { useId, useState } from 'react';
import { TenantContactPersonCreateForm } from '@/components/contacts/tenant-contact-person-create-form';
import { AppDialog } from '@/components/ui/app-dialogs';

type Props = {
  siteId: string;
  label?: string;
};

export function TenantContactPersonCreateDialog({ siteId, label = 'In Stammdaten anlegen' }: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId().replace(/:/g, '');

  return (
    <>
      <button type="button" className="table-action-link" onClick={() => setOpen(true)}>
        {label}
      </button>
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ansprechpartner anlegen"
        footer={
          open ? (
            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button type="submit" form={formId} className="primary-button primary-button--compact">
                Ansprechpartner anlegen
              </button>
            </div>
          ) : null
        }
      >
        {open ? (
          <>
            <p className="muted site-team-add-form-lead">
              Ansprechpartner für Baustellen (z. B. Bauleiter, Bauherr) zentral pflegen und in Baustellen zuordnen.
            </p>
            <TenantContactPersonCreateForm formId={formId} revalidateSiteId={siteId} hideActions />
          </>
        ) : null}
      </AppDialog>
    </>
  );
}
