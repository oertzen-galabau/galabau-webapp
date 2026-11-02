'use client';

import { useId, useState } from 'react';
import { PartnerCreateForm } from '@/components/partners/partner-create-form';
import { AppDialog } from '@/components/ui/app-dialogs';

type Props = {
  siteId: string;
  label?: string;
};

export function PartnerSupplierCreateDialog({ siteId, label = 'In Stammdaten anlegen' }: Props) {
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
        title="Lieferant anlegen"
        footer={
          open ? (
            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button type="submit" form={formId} className="primary-button primary-button--compact">
                Eintrag anlegen
              </button>
            </div>
          ) : null
        }
      >
        {open ? <PartnerCreateForm kind="supplier" formId={formId} revalidateSiteId={siteId} hideActions /> : null}
      </AppDialog>
    </>
  );
}
