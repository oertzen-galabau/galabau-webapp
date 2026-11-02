'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  optimisticPauseEndIntervals,
  optimisticPauseStartIntervals,
} from '@/lib/time-tracking/optimistic-clock';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { useAppNavigation } from '@/components/app-shell/navigation-pending-context';
import { Clock3, Pause, Play, Square } from 'lucide-react';
import {
  clockInWork,
  clockPauseEnd,
  clockPauseStart,
  type LiveClockSnapshot,
} from '@/lib/actions/time-clock';
import {
  needsEarlyStartReasonNow,
  type TodayScheduleContext,
} from '@/lib/time-tracking/today-schedule-context';
import type { PauseEndConfirmPrompt } from '@/lib/time-tracking/pause-confirm-prompt';
import type { TimeEntry, TimeEntryInterval } from '@/lib/types/database';
import {
  adjustLiveDisplaySeconds,
  computeLiveWorkSeconds,
  deriveWorkDayState,
  headerClockCompactStatusLabel,
  pauseAvailable,
} from '@/lib/time-tracking/work-day';
import {
  ClockOutDialog,
  type ClockOutContext,
} from '@/components/time-tracking/clock-out-dialog';
import { getClockOutContext } from '@/lib/actions/payroll';
import { formatDurationHM } from '@/lib/utils/time';
import { EarlyStartClockInDialog } from '@/components/time-tracking/early-start-clock-in-dialog';

type Props = {
  todayEntry: TimeEntry | null;
  todayIntervals?: TimeEntryInterval[];
  todayScheduleContext?: TodayScheduleContext | null;
  canRecord: boolean;
  onPauseConfirm?: (prompt: PauseEndConfirmPrompt) => void;
  onPauseConfirmLoading?: () => void;
  onPauseConfirmDismiss?: () => void;
  onAfterPauseEnd?: () => void;
};

export function HeaderTimeClock({
  todayEntry,
  todayIntervals = [],
  todayScheduleContext = null,
  canRecord,
  onPauseConfirm,
  onPauseConfirmLoading,
  onPauseConfirmDismiss,
  onAfterPauseEnd,
}: Props) {
  const { refresh, navigate } = useAppNavigation();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [clockOutContext, setClockOutContext] = useState<ClockOutContext | null>(null);
  const [loadingClockOut, setLoadingClockOut] = useState(false);
  const [earlyStartOpen, setEarlyStartOpen] = useState(false);
  const [scheduleContext, setScheduleContext] = useState<TodayScheduleContext | null>(null);
  const freshClockInRef = useRef(false);
  const [displayBaselineSeconds, setDisplayBaselineSeconds] = useState<number | null>(null);
  const [liveEntry, setLiveEntry] = useState(todayEntry);
  const [liveIntervals, setLiveIntervals] = useState(todayIntervals);
  /** Verhindert, dass ein langsamer Layout-Refresh optimistische UI zurücksetzt. */
  const propSyncLockRef = useRef(0);

  useEffect(() => {
    if (propSyncLockRef.current > 0) return;
    setLiveEntry(todayEntry);
    setLiveIntervals(todayIntervals);
  }, [todayEntry, todayIntervals]);

  function applyLiveSnapshot(snapshot: LiveClockSnapshot) {
    setLiveEntry(snapshot.entry);
    setLiveIntervals(snapshot.intervals);
  }

  const state = deriveWorkDayState(liveEntry, liveIntervals);
  const statusLabel = headerClockCompactStatusLabel(state);

  useEffect(() => {
    if (state === 'working') {
      setNow(new Date());
      if (freshClockInRef.current && liveEntry) {
        const baseline = computeLiveWorkSeconds(liveEntry, new Date(), 'Europe/Berlin', liveIntervals);
        setDisplayBaselineSeconds(baseline);
        freshClockInRef.current = false;
      }
      const interval = window.setInterval(() => setNow(new Date()), 1000);
      return () => window.clearInterval(interval);
    }
    if (state === 'idle') {
      setDisplayBaselineSeconds(null);
    }
  }, [state, liveEntry, liveIntervals]);

  const serverSeconds = computeLiveWorkSeconds(liveEntry, now, 'Europe/Berlin', liveIntervals);
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
        queueMicrotask(() => refresh());
      } catch (err) {
        freshClockInRef.current = false;
        setError(err instanceof Error ? err.message : 'Fehler');
      }
    });
  }

  function syncPauseWithServer(
    applyOptimistic: () => TimeEntryInterval[],
    serverCall: () => Promise<LiveClockSnapshot | { snapshot: LiveClockSnapshot; confirmPrompt: PauseEndConfirmPrompt | null }>,
    onSuccess?: (result: { snapshot: LiveClockSnapshot; confirmPrompt: PauseEndConfirmPrompt | null }) => void,
    onError?: () => void,
  ) {
    if (!liveEntry) return;
    setError(null);

    const rollback = { entry: liveEntry, intervals: liveIntervals };
    try {
      setLiveIntervals(applyOptimistic());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
      return;
    }

    propSyncLockRef.current += 1;
    void (async () => {
      try {
        const raw = await serverCall();
        const snapshot = 'snapshot' in raw ? raw.snapshot : raw;
        const confirmPrompt = 'confirmPrompt' in raw ? raw.confirmPrompt : null;
        setLiveEntry(snapshot.entry);
        setLiveIntervals(snapshot.intervals);
        onSuccess?.({ snapshot, confirmPrompt });
      } catch (err) {
        setLiveEntry(rollback.entry);
        setLiveIntervals(rollback.intervals);
        setError(err instanceof Error ? err.message : 'Fehler');
        onError?.();
      } finally {
        propSyncLockRef.current -= 1;
      }
    })();
  }

  function handleClockInClick() {
    setError(null);
    if (
      todayScheduleContext &&
      needsEarlyStartReasonNow(todayScheduleContext) &&
      todayScheduleContext.plannedStartTime
    ) {
      setScheduleContext(todayScheduleContext);
      setEarlyStartOpen(true);
      return;
    }
    run(async () => {
      const snapshot = await clockInWork();
      applyLiveSnapshot(snapshot);
    }, { markFreshClockIn: true });
  }

  function openClockOutDialog() {
    if (!liveEntry) return;
    setError(null);
    setClockOutOpen(true);
    setClockOutContext(null);
    setLoadingClockOut(true);
    void (async () => {
      try {
        const ctx = await getClockOutContext();
        setClockOutContext(ctx);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler');
        setClockOutOpen(false);
        setClockOutContext(null);
      } finally {
        setLoadingClockOut(false);
      }
    })();
  }

  function closeClockOutDialog() {
    setClockOutOpen(false);
    setClockOutContext(null);
    setLoadingClockOut(false);
  }

  function handlePauseEnd() {
    onPauseConfirmLoading?.();
    syncPauseWithServer(
      () => optimisticPauseEndIntervals(liveEntry!, liveIntervals),
      () => clockPauseEnd(),
      ({ confirmPrompt }) => {
        if (confirmPrompt) {
          onPauseConfirm?.(confirmPrompt);
        } else {
          onPauseConfirmDismiss?.();
          onAfterPauseEnd?.();
        }
      },
      () => onPauseConfirmDismiss?.(),
    );
  }

  function handlePauseStart() {
    syncPauseWithServer(
      () => optimisticPauseStartIntervals(liveEntry!, liveIntervals),
      () => clockPauseStart(),
    );
  }

  const canBreak = pauseAvailable(liveEntry, liveIntervals);
  const timeLabel = formatDurationHM(displaySeconds);
  const pauseActive =
    state === 'paused' || state === 'breakfast' || state === 'lunch';
  const clockStateClass = pauseActive ? 'paused' : state;

  if (state === 'idle') {
    return (
      <>
        <button
          type="button"
          className="header-clock header-clock--idle header-clock-cta"
          disabled={pending}
          onClick={handleClockInClick}
          title={error ?? undefined}
        >
          {pending ? <InlineSpinner size={18} /> : <Play size={18} fill="currentColor" />}
          <span>{pending ? 'Wird gestartet …' : 'Zeit erfassen'}</span>
        </button>
        {scheduleContext ? (
          <EarlyStartClockInDialog
            open={earlyStartOpen}
            onClose={() => setEarlyStartOpen(false)}
            schedule={scheduleContext}
            onSuccess={(snapshot) => {
              applyLiveSnapshot(snapshot);
              freshClockInRef.current = true;
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div
        className="header-clock-track"
        title={error ?? undefined}
        role="group"
        aria-label="Zeiterfassung"
      >
        <div className={`header-clock-main header-clock-main--${clockStateClass}`}>
          <span className="header-clock-status">
            <i className="header-clock-dot" aria-hidden />
            {statusLabel}
          </span>
          <strong className="header-clock-time" aria-live="polite">
            {timeLabel}
          </strong>
        </div>

        <div className="header-clock-actions">
          {state === 'working' && (
            <>
              {canBreak ? (
                <button
                  type="button"
                  className="header-clock-action header-clock-action--secondary"
                  onClick={handlePauseStart}
                  aria-label="Pause starten"
                >
                  <Pause size={16} fill="currentColor" />
                  <span>Pause</span>
                </button>
              ) : (
                <span className="header-clock-action-spacer" aria-hidden />
              )}
              <button
                type="button"
                className="header-clock-action header-clock-action--stop"
                disabled={!liveEntry}
                onClick={openClockOutDialog}
                aria-label="Feierabend"
              >
                <Square size={16} fill="currentColor" />
                <span>Ende</span>
              </button>
            </>
          )}

          {pauseActive && (
              <button
                type="button"
                className="header-clock-action header-clock-action--primary header-clock-action--span"
                onClick={handlePauseEnd}
                aria-label="Pause beenden, weiter arbeiten"
              >
                <Play size={16} fill="currentColor" />
                <span>Weiter</span>
              </button>
          )}

          {state === 'finished' && (
            <>
              <span className="header-clock-action-spacer" aria-hidden />
              <button
                type="button"
                className="header-clock-action header-clock-action--primary"
                onClick={() => navigate('/app/zeiten')}
                aria-label="Zeiten ansehen"
              >
                <Clock3 size={16} />
                <span>Zeiten</span>
              </button>
            </>
          )}
        </div>
      </div>

      {liveEntry && clockOutOpen ? (
        <ClockOutDialog
          open={clockOutOpen}
          onClose={closeClockOutDialog}
          todayEntry={liveEntry}
          context={clockOutContext}
          loading={loadingClockOut || clockOutContext == null}
        />
      ) : null}
    </>
  );
}
