'use client';

import { useState, useTransition } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';
import { clockInWork, type LiveClockSnapshot } from '@/lib/actions/time-clock';
import type { TodayScheduleContext } from '@/lib/time-tracking/today-schedule-context';
import { EARLY_START_REASON_MIN_LENGTH } from '@/lib/schedule/planned-day-start';
import { useAppNavigation } from '@/components/app-shell/navigation-pending-context';

type Props = {
  open: boolean;
  onClose: () => void;
  schedule: TodayScheduleContext;
  onSuccess?: (snapshot: LiveClockSnapshot) => void;
};

export function EarlyStartClockInDialog({ open, onClose, schedule, onSuccess }: Props) {
  const { refresh } = useAppNavigation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const snapshot = await clockInWork({ earlyStartReason: reason });
        onSuccess?.(snapshot);
        queueMicrotask(() => refresh());
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
      title="Früher Start"
      footer={
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={pending}>
            Abbrechen
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={pending || reason.trim().length < EARLY_START_REASON_MIN_LENGTH}
            onClick={submit}
          >
            {pending ? 'Startet …' : 'Zeit erfassen'}
          </button>
        </div>
      }
    >
      <p>
        Geplant ab <strong>{schedule.plannedStartTime}</strong>
        {schedule.plannedSiteName ? ` · ${schedule.plannedSiteName}` : ''}. Warum startest du früher?
      </p>
      <label className="dialog-field">
        Grund (Pflicht)
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={EARLY_START_REASON_MIN_LENGTH}
        />
      </label>
      {error ? <p className="dialog-error">{error}</p> : null}
    </AppDialog>
  );
}
