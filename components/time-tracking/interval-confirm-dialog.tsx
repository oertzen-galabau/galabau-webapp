'use client';

import { useEffect, useState, useTransition } from 'react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { AppDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';
import { confirmIntervalType } from '@/lib/actions/time-clock';
import type { PauseEndConfirmPrompt } from '@/lib/time-tracking/pause-confirm-prompt';
import type { TimeBlockType } from '@/lib/types/database';
import { BLOCK_TYPE_LABELS } from '@/lib/time-tracking/timeline';
import { toTimeString } from '@/lib/time-tracking/work-day';
import { useAppNavigation } from '@/components/app-shell/navigation-pending-context';

const PAUSE_TYPE_OPTIONS = (
  ['travel', 'breakfast', 'lunch', 'other_work'] as TimeBlockType[]
).map((value) => ({ value, label: BLOCK_TYPE_LABELS[value] }));

type Props = {
  open: boolean;
  prompt: PauseEndConfirmPrompt | null;
  loading?: boolean;
  onClose: () => void;
};

export function IntervalConfirmDialog({ open, prompt, loading = false, onClose }: Props) {
  const { refresh } = useAppNavigation();
  const [pending, startTransition] = useTransition();
  const [selectedType, setSelectedType] = useState<TimeBlockType>('travel');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prompt) {
      setSelectedType(prompt.suggestedBlockType);
      setError(null);
    }
  }, [prompt]);

  if (!open) return null;

  if (loading) {
    return (
      <AppDialog open={open} onClose={onClose} title="Pause zuordnen">
        <div className="dialog-loading-state" role="status" aria-live="polite">
          <InlineSpinner size={28} />
          <p>Pause wird geladen …</p>
        </div>
      </AppDialog>
    );
  }

  if (!prompt) return null;

  const from = toTimeString(new Date(prompt.pauseStartedAt)).slice(0, 5);
  const to = toTimeString(new Date(prompt.pauseEndedAt)).slice(0, 5);
  function confirm(type: TimeBlockType) {
    setError(null);
    startTransition(async () => {
      try {
        await confirmIntervalType(prompt!.intervalId, type);
        refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler');
      }
    });
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Pause zuordnen"
      footer={
        <div className="dialog-actions">
          <button
            type="button"
            className="primary-button"
            disabled={pending}
            onClick={() => confirm(selectedType)}
          >
            {pending ? 'Speichern …' : 'Speichern'}
          </button>
        </div>
      }
    >
      <p>
        Deine Pause von <strong>{from}</strong> bis <strong>{to}</strong> — welche Art war das?
      </p>
      <p className="muted">
        Vorschlag: {BLOCK_TYPE_LABELS[prompt.suggestedBlockType]}
      </p>
      <label className="dialog-field">
        Art der Pause
        <AppSelect
          value={selectedType}
          onValueChange={(value) => setSelectedType(value as TimeBlockType)}
          options={PAUSE_TYPE_OPTIONS}
          disabled={pending}
        />
      </label>
      {error ? <p className="dialog-error">{error}</p> : null}
    </AppDialog>
  );
}
