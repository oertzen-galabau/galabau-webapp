'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';
import { SiteCreateForm } from '@/components/sites/site-create-form';
import type { ForemanOption } from '@/lib/sites/foremen-options';

type Props = {
  foremanOptions: ForemanOption[];
};

export function SiteCreateDialog({ foremanOptions }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="primary-button" onClick={() => setOpen(true)}>
        <Plus size={17} aria-hidden />
        Neue Baustelle
      </button>
      <AppDialog open={open} onClose={() => setOpen(false)} title="Neue Baustelle">
        {open ? (
          <SiteCreateForm
            key="new-site"
            foremanOptions={foremanOptions}
            onCancel={() => setOpen(false)}
            onSuccess={() => setOpen(false)}
          />
        ) : null}
      </AppDialog>
    </>
  );
}
