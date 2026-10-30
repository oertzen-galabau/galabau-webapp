'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, Pause, Play, Square } from 'lucide-react';
import { clockInWork, clockPauseEnd, clockPauseStart } from '@/lib/actions/employee';
import type { TimeEntry } from '@/lib/types/database';
import {
  adjustLiveDisplaySeconds,
  computeLiveWorkSeconds,
  deriveWorkDayState,
  headerClockStateLabel,
  pauseAvailable,
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
  const freshClockInRef = useRef(false);
  const [displayBaselineSeconds, setDisplayBaselineSeconds] = useState<number | null>(null);

  const state = deriveWorkDayState(todayEntry);
  const statusLabel = headerClockStateLabel(state);

  useEffect(() => {
    if (state === 'working') {
      setNow(new Date());
      if (freshClockInRef.current && todayEntry) {
        const baseline = computeLiveWorkSeconds(todayEntry, new Date());
        setDisplayBaselineSeconds(baseline);
        freshClockInRef.current = false;
      }
      const interval = window.setInterval(() => setNow(new Date()), 1000);
      return () => window.clearInterval(interval);
    }
    if (state === 'idle') {
      setDisplayBaselineSeconds(null);
    }
  }, [state, todayEntry]);

  const serverSeconds = computeLiveWorkSeconds(todayEntry, now);
  const displaySeconds = adjustLiveDisplaySeconds(serverSeconds, displayBaselineSeconds);

  if (!canRecord) return null;

  function run(action: () => Promise<void>, options?: { markFreshClockIn?: boolean }) {
    setError(null);
    if (options?.markFreshClockIn) {
      freshClockInRef.current = true;
    }
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        freshClockInRef.current = false;
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

  const canBreak = pauseAvailable(todayEntry);
  const timeLabel = formatDurationHMS(displaySeconds);
  const pauseActive = state === 'breakfast' || state === 'lunch';
  const clockStateClass = pauseActive ? 'paused' : state;

  if (state === 'idle') {
    return (
      <button
        type="button"
        className="header-clock header-clock--idle header-clock-cta"
        disabled={pending}
        onClick={() => run(clockInWork, { markFreshClockIn: true })}
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
        className={`header-clock header-clock--${clockStateClass}`}
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
                  onClick={() => run(clockPauseStart)}
                  aria-label="Pause starten"
                >
                  <Pause size={16} fill="currentColor" />
                  <span>Pause</span>
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

          {pauseActive && (
            <button
              type="button"
              className="header-clock-action header-clock-action--primary"
              disabled={pending}
              onClick={() => run(clockPauseEnd)}
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
