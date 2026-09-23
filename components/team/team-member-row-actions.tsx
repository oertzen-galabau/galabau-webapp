'use client';

import { Ban, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteTeamMember, setMemberActive } from '@/lib/actions/admin';
import { ConfirmDialog } from '@/components/ui/app-dialogs';

type Props = {
  memberId: string;
  memberName: string;
  isActive: boolean;
  isSelf: boolean;
  canDeactivate: boolean;
  canDelete: boolean;
};

type DialogKind = 'deactivate' | 'activate' | 'delete' | null;

export function TeamMemberRowActions({
  memberId,
  memberName,
  isActive,
  isSelf,
  canDeactivate,
  canDelete,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isSelf || (!canDeactivate && !canDelete)) {
    return <div className="team-row-actions team-row-actions--empty" aria-hidden="true" />;
  }

  function runAction(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setDialog(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.');
      }
    });
  }

  function confirmDeactivate() {
    const formData = new FormData();
    formData.set('user_id', memberId);
    formData.set('is_active', 'false');
    runAction(() => setMemberActive(formData));
  }

  function confirmActivate() {
    const formData = new FormData();
    formData.set('user_id', memberId);
    formData.set('is_active', 'true');
    runAction(() => setMemberActive(formData));
  }

  function confirmDelete() {
    const formData = new FormData();
    formData.set('user_id', memberId);
    runAction(() => deleteTeamMember(formData));
  }

  const deactivateMessage =
    error ??
    `${memberName} kann sich danach nicht mehr anmelden. Stammdaten und Historie bleiben erhalten. Sie können das Konto jederzeit wieder aktivieren.`;

  const activateMessage =
    error ?? `${memberName} kann sich wieder anmelden, sofern ein gültiger Zugang besteht.`;

  const deleteMessage =
    error ??
    `${memberName} wird endgültig gelöscht (Login, Profil, Einladungen). Verknüpfte Einträge in der App bleiben ggf. anonymisiert. Dies kann nicht rückgängig gemacht werden.`;

  return (
    <>
      <div className="team-row-actions" onClick={(e) => e.stopPropagation()}>
        {canDeactivate && isActive && (
          <button
            type="button"
            className="input-form-row-action"
            onClick={() => setDialog('deactivate')}
            disabled={pending}
            aria-label={`${memberName} deaktivieren`}
            title="Deaktivieren"
          >
            <Ban size={18} />
          </button>
        )}
        {canDeactivate && !isActive && (
          <button
            type="button"
            className="input-form-row-action input-form-row-action--add"
            onClick={() => setDialog('activate')}
            disabled={pending}
            aria-label={`${memberName} aktivieren`}
            title="Aktivieren"
          >
            <RotateCcw size={18} />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="input-form-row-action input-form-row-action--remove"
            onClick={() => setDialog('delete')}
            disabled={pending}
            aria-label={`${memberName} löschen`}
            title="Löschen"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === 'deactivate'}
        onClose={() => { setDialog(null); setError(null); }}
        title={`${memberName} deaktivieren?`}
        message={deactivateMessage}
        confirmLabel="Deaktivieren"
        onConfirm={confirmDeactivate}
        pending={pending}
        danger
      />
      <ConfirmDialog
        open={dialog === 'activate'}
        onClose={() => { setDialog(null); setError(null); }}
        title={`${memberName} aktivieren?`}
        message={activateMessage}
        confirmLabel="Aktivieren"
        onConfirm={confirmActivate}
        pending={pending}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => { setDialog(null); setError(null); }}
        title={`${memberName} endgültig löschen?`}
        message={deleteMessage}
        confirmLabel="Endgültig löschen"
        onConfirm={confirmDelete}
        pending={pending}
        danger
      />
    </>
  );
}
