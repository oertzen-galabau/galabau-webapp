'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, Pause, Play, Square } from 'lucide-react';
import {
  clockBreakfastEnd,
  clockBreakfastStart,
  clockInWork,
  clockLunchEnd,
  clockLunchStart,
} from '@/lib/actions/employee';
import type { TimeEntry } from '@/lib/types/database';
import {
  breakfastAvailable,
  computeLiveWorkSeconds,
  deriveWorkDayState,
  lunchAvailable,
  workDayStateLabel,
} from '@/lib/time-tracking/work-day';
import {
  ClockOutDialog,
  type ClockOutContext,
} from '@/components/time-tracking/clock-out-dialog';
import { getClockOutContext } from '@/lib/actions/payroll';
import { formatDurationHMS } from '@/lib/utils/time';

type Props = {
  todayEntry: TimeEntry | null;
  canRecord: boolean;
};

export function HeaderTimeClock({ todayEntry, canRecord }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [clockOutContext, setClockOutContext] = useState<ClockOutContext | null>(null);
  const [loadingClockOut, setLoadingClockOut] = useState(false);

  const state = deriveWorkDayState(todayEntry);
  const statusLabel = workDayStateLabel(state);

  useEffect(() => {
    if (state !== 'working') return;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [state]);

  const displaySeconds = computeLiveWorkSeconds(todayEntry, now);

  if (!canRecord) return null;

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler');
      }
    });
  }

  async function openClockOutDialog() {
    if (!todayEntry) return;
    setLoadingClockOut(true);
    setError(null);
    try {
      const ctx = await getClockOutContext();
      setClockOutContext(ctx);
      setClockOutOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoadingClockOut(false);
    }
  }

  function closeClockOutDialog() {
    setClockOutOpen(false);
    setClockOutContext(null);
  }

  function startBreak() {
    if (breakfastAvailable(todayEntry)) {
      run(clockBreakfastStart);
      return;
    }
    if (lunchAvailable(todayEntry)) {
      run(clockLunchStart);
    }
  }

  const canBreak = breakfastAvailable(todayEntry) || lunchAvailable(todayEntry);
  const breakLabel = breakfastAvailable(todayEntry) ? 'Frühstück' : 'Mittag';
  const timeLabel = formatDurationHMS(displaySeconds);

  if (state === 'idle') {
    return (
      <button
        type="button"
        className="header-clock header-clock--idle header-clock-cta"
        disabled={pending}
        onClick={() => run(clockInWork)}
        title={error ?? undefined}
      >
        <Play size={18} fill="currentColor" />
        <span>Zeit erfassen</span>
      </button>
    );
  }

  return (
    <>
      <div
        className={`header-clock header-clock--${state}`}
        title={error ?? undefined}
        role="group"
        aria-label="Zeiterfassung"
      >
        <div className="header-clock-display">
          <span className="header-clock-status">
            <i className="header-clock-dot" />
            {statusLabel}
          </span>
          <strong className="header-clock-time" aria-live="polite">
            {timeLabel}
          </strong>
        </div>

        <div className="header-clock-actions">
          {state === 'working' && (
            <>
              {canBreak && (
                <button
                  type="button"
                  className="header-clock-action header-clock-action--secondary"
                  disabled={pending}
                  onClick={startBreak}
                  aria-label={`${breakLabel}spause starten`}
                >
                  <Pause size={16} fill="currentColor" />
                  <span>{breakLabel}</span>
                </button>
              )}
              <button
                type="button"
                className="header-clock-action header-clock-action--stop"
                disabled={pending || loadingClockOut || !todayEntry}
                onClick={() => void openClockOutDialog()}
                aria-label="Feierabend"
              >
                <Square size={15} fill="currentColor" />
                <span>Feierabend</span>
              </button>
            </>
          )}

          {(state === 'breakfast' || state === 'lunch') && (
            <button
              type="button"
              className="header-clock-action header-clock-action--primary"
              disabled={pending}
              onClick={() => run(state === 'breakfast' ? clockBreakfastEnd : clockLunchEnd)}
              aria-label="Pause beenden"
            >
              <Play size={16} fill="currentColor" />
              <span>Weiter</span>
            </button>
          )}

          {state === 'finished' && (
            <button
              type="button"
              className="header-clock-action header-clock-action--primary"
              onClick={() => router.push('/app/zeiten')}
              aria-label="Zeiten ansehen"
            >
              <Clock3 size={16} />
              <span>Zeiten</span>
            </button>
          )}
        </div>
      </div>

      {todayEntry && clockOutContext ? (
        <ClockOutDialog
          open={clockOutOpen}
          onClose={closeClockOutDialog}
          todayEntry={todayEntry}
          context={clockOutContext}
        />
      ) : null}
    </>
  );
}
