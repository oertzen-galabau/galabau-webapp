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
import type { TimeEntry, TenantTimeTrackingRules } from '@/lib/types/database';
import {
  breakfastAvailable,
  computeLiveWorkSeconds,
  deriveWorkDayState,
  lunchAvailable,
  workDayStateLabel,
} from '@/lib/time-tracking/work-day';
import {
  TimeEntryTimelineFields,
  type SiteOption,
} from '@/components/time-tracking/time-entry-timeline-fields';
import { formatDurationHMS } from '@/lib/utils/time';
import type { TimelineBlockInput } from '@/lib/time-tracking/timeline';
import { evaluateBreakCompliance } from '@/lib/time-tracking/break-rules';
import { parseTime } from '@/lib/utils/time';

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
  const [isDriver, setIsDriver] = useState(false);
  const [badWeatherClaimed, setBadWeatherClaimed] = useState(false);
  const [isBadWeatherSeason, setIsBadWeatherSeason] = useState(false);
  const [badWeatherSeasonLabel, setBadWeatherSeasonLabel] = useState('');
  const [timelineBlocks, setTimelineBlocks] = useState<TimelineBlockInput[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [dayStart, setDayStart] = useState('');
  const [dayEnd, setDayEnd] = useState('');
  const [timeRules, setTimeRules] = useState<TenantTimeTrackingRules | null>(null);
  const [missingBreakfastReason, setMissingBreakfastReason] = useState('');
  const [missingLunchReason, setMissingLunchReason] = useState('');
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
        setClockOutOpen(false);
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

  async function openClockOutDialog() {
    setLoadingContext(true);
    setError(null);
    try {
      const ctx = await getClockOutContext();
      setSites(ctx.sites);
      setIsBadWeatherSeason(ctx.isBadWeatherSeason);
      setBadWeatherSeasonLabel(ctx.badWeatherSeasonLabel);
      setBadWeatherClaimed(false);
      setDayStart(ctx.startTime ?? todayEntry?.start_time?.slice(0, 5) ?? '');
      setDayEnd(ctx.endTime);
      setTimelineBlocks(ctx.defaultTimeline);
      setTimeRules(ctx.timeRules);
      setMissingBreakfastReason('');
      setMissingLunchReason('');
      setClockOutOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoadingContext(false);
    }
  }

  function submitClockOut() {
    const payload: ClockOutPayload = {
      isDriver,
      badWeatherClaimed: isBadWeatherSeason ? badWeatherClaimed : false,
      segments: timelineBlocks,
      missingBreakfastReason: missingBreakfastReason.trim() || null,
      missingLunchReason: missingLunchReason.trim() || null,
    };
    run(() => clockOutWork(undefined, payload));
  }

  const canBreak = breakfastAvailable(todayEntry) || lunchAvailable(todayEntry);
  const breakLabel = breakfastAvailable(todayEntry) ? 'Frühstück' : 'Mittag';
  const timeLabel = formatDurationHMS(displaySeconds);

  const grossMinutes =
    parseTime(dayStart) != null && parseTime(dayEnd) != null
      ? (parseTime(dayEnd)! - parseTime(dayStart)!)
      : 0;

  const breakCompliance = timeRules
    ? evaluateBreakCompliance({
        rules: timeRules,
        grossWorkMinutes: grossMinutes,
        blocks: timelineBlocks,
        trackedBreakfast: {
          start: todayEntry?.breakfast_start ?? null,
          end: todayEntry?.breakfast_end ?? null,
        },
        trackedLunch: {
          start: todayEntry?.lunch_start ?? null,
          end: todayEntry?.lunch_end ?? null,
        },
        missingBreakfastReason,
        missingLunchReason,
      })
    : null;

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

      {clockOutOpen && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setClockOutOpen(false)}>
          <div
            className="dialog-panel dialog-panel--wide"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Feierabend</h2>
            <p className="muted">
              Teile deinen Arbeitstag lückenlos in Baustellen, Wegezeiten, Pausen oder sonstige Arbeit ein.
            </p>

            <label className="dialog-field input-form-checkbox">
              <input
                type="checkbox"
                checked={isDriver}
                onChange={(event) => setIsDriver(event.target.checked)}
              />
              Heute Fahrer? (Fahrer-Zuschlag ca. 6 € nach Freigabe)
            </label>

            {isBadWeatherSeason && (
              <>
                <label className="dialog-field input-form-checkbox">
                  <input
                    type="checkbox"
                    checked={badWeatherClaimed}
                    onChange={(event) => setBadWeatherClaimed(event.target.checked)}
                  />
                  Schlechtwetter (KUG) — heute am Standort
                </label>
                <p className="muted">
                  Saison {badWeatherSeasonLabel}. Buchung 8110 wird nach Freigabe durch das Büro bestätigt.
                </p>
              </>
            )}

            <TimeEntryTimelineFields
              sites={sites}
              dayStart={dayStart}
              dayEnd={dayEnd}
              initialBlocks={timelineBlocks}
              onChange={setTimelineBlocks}
            />

            {breakCompliance?.missingBreakfastReasonRequired && (
              <label className="dialog-field">
                Grund fehlendes Frühstück (Pflicht)
                <textarea
                  rows={2}
                  value={missingBreakfastReason}
                  onChange={(event) => setMissingBreakfastReason(event.target.value)}
                  required
                />
              </label>
            )}

            {breakCompliance?.missingLunchReasonRequired && (
              <label className="dialog-field">
                Grund fehlende Mittagspause (Pflicht)
                <textarea
                  rows={2}
                  value={missingLunchReason}
                  onChange={(event) => setMissingLunchReason(event.target.value)}
                  required
                />
              </label>
            )}

            {error && <p className="dialog-error">{error}</p>}

            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => setClockOutOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={pending}
                onClick={submitClockOut}
              >
                Feierabend speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
