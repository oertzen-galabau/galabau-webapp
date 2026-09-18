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
  clockOutWork,
  type ClockOutPayload,
} from '@/lib/actions/employee';
import { getClockOutContext } from '@/lib/actions/payroll';
import type { TimeEntry } from '@/lib/types/database';
import {
  breakfastAvailable,
  computeLiveWorkSeconds,
  deriveWorkDayState,
  hasRecordedBreak,
  lunchAvailable,
  workDayStateLabel,
} from '@/lib/time-tracking/work-day';
import { TimeEntrySegmentsFields, type SegmentRow } from '@/components/time-tracking/time-entry-segments-fields';
import { formatDurationHMS } from '@/lib/utils/time';

type Props = {
  todayEntry: TimeEntry | null;
  canRecord: boolean;
};

type DialogStep = 'noBreakConfirm' | 'noBreakReason' | 'clockOut';

export function HeaderTimeClock({ todayEntry, canRecord }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [dialogStep, setDialogStep] = useState<DialogStep | null>(null);
  const [noBreakReason, setNoBreakReason] = useState('');
  const [isDriver, setIsDriver] = useState(false);
  const [badWeatherClaimed, setBadWeatherClaimed] = useState(false);
  const [isBadWeatherSeason, setIsBadWeatherSeason] = useState(false);
  const [segments, setSegments] = useState<SegmentRow[]>([{ siteId: '', travelMinutes: 0 }]);
  const [sites, setSites] = useState<{ id: string; name: string; default_travel_minutes?: number }[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

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
        closeDialog();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler');
      }
    });
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

  function closeDialog() {
    setDialogStep(null);
    setNoBreakReason('');
    setError(null);
  }

  async function openClockOutDialog() {
    setLoadingContext(true);
    setError(null);
    try {
      const ctx = await getClockOutContext();
      setSites(ctx.sites);
      setIsBadWeatherSeason(ctx.isBadWeatherSeason);
      setBadWeatherClaimed(false);
      setSegments(
        ctx.defaultSegments.length > 0
          ? ctx.defaultSegments.map((s) => ({ siteId: s.site_id, travelMinutes: s.travel_minutes }))
          : [{ siteId: '', travelMinutes: 0 }],
      );
      setDialogStep('clockOut');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoadingContext(false);
    }
  }

  function handleFeierabendClick() {
    setError(null);
    if (hasRecordedBreak(todayEntry)) {
      void openClockOutDialog();
      return;
    }
    setDialogStep('noBreakConfirm');
  }

  function submitClockOut(reason?: string) {
    const payload: ClockOutPayload = {
      isDriver,
      badWeatherClaimed,
      segments: segments
        .filter((s) => s.siteId)
        .map((s) => ({ site_id: s.siteId, travel_minutes: s.travelMinutes })),
    };
    run(() => clockOutWork(reason, payload));
  }

  function submitNoBreakReason() {
    const reason = noBreakReason.trim();
    if (!reason) {
      setError('Bitte einen Grund angeben.');
      return;
    }
    void openClockOutDialog();
    setNoBreakReason(reason);
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
                disabled={pending || loadingContext}
                onClick={handleFeierabendClick}
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

      {dialogStep && (
        <div className="dialog-backdrop" role="presentation" onClick={closeDialog}>
          <div
            className="dialog-panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {dialogStep === 'noBreakConfirm' && (
              <>
                <h2>Keine Pause erfasst</h2>
                <p className="muted">
                  Du hast heute weder Frühstücks- noch Mittagspause erfasst. Ist das korrekt?
                </p>
                <div className="dialog-actions">
                  <button type="button" className="text-button" onClick={closeDialog}>Abbrechen</button>
                  <button type="button" className="primary-button" onClick={() => setDialogStep('noBreakReason')}>
                    Ja, korrekt
                  </button>
                </div>
              </>
            )}

            {dialogStep === 'noBreakReason' && (
              <>
                <h2>Grund angeben</h2>
                <label className="dialog-field">
                  Grund (Pflicht)
                  <textarea
                    rows={3}
                    value={noBreakReason}
                    onChange={(e) => setNoBreakReason(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                {error && <p className="dialog-error">{error}</p>}
                <div className="dialog-actions">
                  <button type="button" className="text-button" onClick={() => setDialogStep('noBreakConfirm')}>
                    Zurück
                  </button>
                  <button type="button" className="primary-button" onClick={submitNoBreakReason}>
                    Weiter
                  </button>
                </div>
              </>
            )}

            {dialogStep === 'clockOut' && (
              <>
                <h2>Feierabend</h2>
                <label className="dialog-field input-form-checkbox">
                  <input
                    type="checkbox"
                    checked={isDriver}
                    onChange={(e) => setIsDriver(e.target.checked)}
                  />
                  Heute Fahrer? (Fahrer-Zuschlag ca. 6 € nach Freigabe)
                </label>
                <label className="dialog-field input-form-checkbox">
                  <input
                    type="checkbox"
                    checked={badWeatherClaimed}
                    onChange={(e) => setBadWeatherClaimed(e.target.checked)}
                  />
                  Schlechtwetter (KUG) — heute am Standort
                </label>
                {isBadWeatherSeason ? (
                  <p className="muted">
                    Buchung 8110 (Dez.–März) wird nach Freigabe durch das Büro bestätigt.
                  </p>
                ) : (
                  <p className="muted">
                    KUG-Buchung gilt in der Saison Dez.–März. Meldung wird bei der Freigabe bestätigt.
                  </p>
                )}
                <p className="muted">
                  Buchungszeilen werden automatisch erstellt, sobald das Büro deine Zeiten freigibt.
                </p>
                <TimeEntrySegmentsFields
                  sites={sites}
                  initialSegments={segments}
                  onChange={setSegments}
                />
                {error && <p className="dialog-error">{error}</p>}
                <div className="dialog-actions">
                  <button type="button" className="text-button" onClick={closeDialog}>Abbrechen</button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={pending}
                    onClick={() => submitClockOut(noBreakReason.trim() || undefined)}
                  >
                    Feierabend speichern
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
