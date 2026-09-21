'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { removeSite } from '@/lib/actions/admin';
import { ConfirmDialog } from '@/components/ui/app-dialogs';

type Props = {
  siteId: string;
  siteName: string;
  mode: 'delete' | 'archive';
};

export function SiteDeleteButton({ siteId, siteName, mode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isArchive = mode === 'archive';

  function confirmRemove() {
    setError(null);
    const formData = new FormData();
    formData.set('site_id', siteId);
    startTransition(async () => {
      try {
        await removeSite(formData);
        setOpen(false);
        router.push('/app/baustellen');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Entfernen');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={isArchive ? 'text-button' : 'primary-button primary-button--danger'}
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <Trash2 size={17} />
        {isArchive ? 'Archivieren' : 'Entfernen'}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={isArchive ? `${siteName} archivieren?` : `${siteName} endgültig löschen?`}
        message={
          error ??
          (isArchive
            ? 'Diese Baustelle enthält Dokumentation oder verknüpfte Daten und wird archiviert, nicht gelöscht. Sie erscheint nicht mehr in aktiven Listen, bleibt aber einsehbar.'
            : 'Diese Baustelle wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.')
        }
        confirmLabel={isArchive ? 'Archivieren' : 'Endgültig löschen'}
        onConfirm={confirmRemove}
        pending={pending}
        danger={!isArchive}
      />
    </>
  );
}
