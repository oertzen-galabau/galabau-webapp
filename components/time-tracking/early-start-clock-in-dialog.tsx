'use client';

import { useState, useTransition } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';
import { clockInWork, type LiveClockSnapshot } from '@/lib/actions/time-clock';
import type {
  OutsidePlanReasonVariant,
  TodayScheduleContext,
} from '@/lib/time-tracking/today-schedule-context';
import { EARLY_START_REASON_MIN_LENGTH } from '@/lib/schedule/planned-day-start';
import { useAppNavigation } from '@/components/app-shell/navigation-pending-context';

type Props = {
  open: boolean;
  onClose: () => void;
  schedule: TodayScheduleContext;
  variant: OutsidePlanReasonVariant;
  onSuccess?: (snapshot: LiveClockSnapshot) => void;
};

const COPY: Record<
  OutsidePlanReasonVariant,
  { title: string; intro: (schedule: TodayScheduleContext) => string; label: string }
> = {
  early_start: {
    title: 'Früher Start',
    intro: (schedule) =>
      `Geplant ab ${schedule.plannedStartTime}${schedule.plannedSiteName ? ` · ${schedule.plannedSiteName}` : ''}. Warum startest du früher?`,
    label: 'Grund (Pflicht)',
  },
  late_start: {
    title: 'Später Start',
    intro: (schedule) =>
      `Geplant bis ${schedule.plannedEndTime}${schedule.plannedSiteName ? ` · ${schedule.plannedSiteName}` : ''}. Warum startest du nach Planende?`,
    label: 'Grund (Pflicht)',
  },
};

export function EarlyStartClockInDialog({ open, onClose, schedule, variant, onSuccess }: Props) {
  const { refresh } = useAppNavigation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copy = COPY[variant];

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const payload =
          variant === 'early_start'
            ? { earlyStartReason: reason }
            : { lateStartReason: reason };
        const snapshot = await clockInWork(payload);
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
      title={copy.title}
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
      <p>{copy.intro(schedule)}</p>
      <label className="dialog-field">
        {copy.label}
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