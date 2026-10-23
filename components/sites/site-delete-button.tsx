'use client';

import { CheckCircle2, Trash2 } from 'lucide-react';
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

  const isComplete = mode === 'archive';

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
        className={isComplete ? 'secondary-button' : 'primary-button primary-button--danger'}
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {isComplete ? <CheckCircle2 size={17} aria-hidden /> : <Trash2 size={17} aria-hidden />}
        {isComplete ? 'Abgeschlossen' : 'Entfernen'}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={isComplete ? `${siteName} abschließen?` : `${siteName} endgültig löschen?`}
        message={
          error ??
          (isComplete
            ? 'Die Baustelle wird als abgeschlossen markiert und verschwindet aus der aktiven Liste. Dokumentation, Zeiten und verknüpfte Daten bleiben erhalten und sind weiter einsehbar.'
            : 'Diese Baustelle wurde noch nicht genutzt und wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.')
        }
        confirmLabel={isComplete ? 'Abschließen' : 'Endgültig löschen'}
        onConfirm={confirmRemove}
        pending={pending}
        danger={!isComplete}
      />
    </>
  );
}
