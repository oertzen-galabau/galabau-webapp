'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/ui/app-dialogs';

type Props = {
  id: string;
  entityLabel: string;
  onDelete: (formData: FormData) => Promise<void>;
};

export function SiteEntityDeleteButton({ id, entityLabel, onDelete }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    const formData = new FormData();
    formData.set('id', id);
    startTransition(async () => {
      try {
        await onDelete(formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="input-form-row-action input-form-row-action--remove"
        onClick={() => setOpen(true)}
        disabled={pending}
        aria-label={`${entityLabel} entfernen`}
      >
        <Trash2 size={18} />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${entityLabel} entfernen?`}
        message={error ?? 'Dieser Eintrag wird dauerhaft gelöscht.'}
        confirmLabel="Entfernen"
        onConfirm={confirmDelete}
        pending={pending}
        danger
      />
    </>
  );
}
