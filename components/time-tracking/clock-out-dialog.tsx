'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AppDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';
import {
  TimeEntryTimelineFields,
  type SiteOption,
} from '@/components/time-tracking/time-entry-timeline-fields';
import { clockOutWork, type ClockOutPayload } from '@/lib/actions/employee';
import type { getClockOutContext } from '@/lib/actions/payroll';
import type { TimeEntry } from '@/lib/types/database';
import { evaluateBreakCompliance } from '@/lib/time-tracking/break-rules';
import {
  buildDefaultTimeline,
  primarySiteIdFromBlocks,
  validateTimeline,
  type TimelineBlockInput,
} from '@/lib/time-tracking/timeline';
import { formatMinutes, parseTime } from '@/lib/utils/time';
import type { DriverTrip } from '@/lib/types/database';
import { DriverTripSelect } from '@/components/time-tracking/driver-trip-select';

export type ClockOutContext = Awaited<ReturnType<typeof getClockOutContext>>;

type Props = {
  open: boolean;
  onClose: () => void;
  todayEntry: TimeEntry;
  context: ClockOutContext;
};

export function ClockOutDialog({ open, onClose, todayEntry, context }: Props) {
  const sessionKey = `${context.endTime}-${context.startTime ?? todayEntry.start_time}`;

  return (
    <ClockOutDialogSession
      key={sessionKey}
      open={open}
      onClose={onClose}
      todayEntry={todayEntry}
      context={context}
    />
  );
}

function ClockOutDialogSession({
  open,
  onClose,
  todayEntry,
  context,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dayStart = context.startTime ?? todayEntry.start_time?.slice(0, 5) ?? '';
  const dayEnd = context.endTime;
  const initialSiteId =
    context.assignedSiteId ?? primarySiteIdFromBlocks(context.defaultTimeline) ?? '';

  const [driverTrip, setDriverTrip] = useState<DriverTrip>('none');
  const [badWeatherClaimed, setBadWeatherClaimed] = useState(false);
  const [timelineBlocks, setTimelineBlocks] = useState<TimelineBlockInput[]>(context.defaultTimeline);
  const [missingBreakfastReason, setMissingBreakfastReason] = useState('');
  const [missingLunchReason, setMissingLunchReason] = useState('');
  const [primarySiteId, setPrimarySiteId] = useState(initialSiteId);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [timelineCustomized, setTimelineCustomized] = useState(false);

  const sites = context.sites as SiteOption[];

  function rebuildTimelineForSite(siteId: string) {
    setTimelineBlocks(
      buildDefaultTimeline({
        startTime: dayStart,
        endTime: dayEnd,
        breakfastStart: todayEntry.breakfast_start,
        breakfastEnd: todayEntry.breakfast_end,
        lunchStart: todayEntry.lunch_start,
        lunchEnd: todayEntry.lunch_end,
        defaultSiteId: siteId || null,
      }),
    );
  }

  function handlePrimarySiteChange(siteId: string) {
    setPrimarySiteId(siteId);
    if (!timelineCustomized) {
      rebuildTimelineForSite(siteId);
    }
  }

  function handleTimelineChange(blocks: TimelineBlockInput[]) {
    setTimelineCustomized(true);
    setTimelineBlocks(blocks);
  }

  const grossMinutes =
    parseTime(dayStart) != null && parseTime(dayEnd) != null
      ? parseTime(dayEnd)! - parseTime(dayStart)!
      : 0;

  const timelinePreview = useMemo(
    () => validateTimeline(timelineBlocks, dayStart, dayEnd, { requireFullCoverage: true }),
    [timelineBlocks, dayStart, dayEnd],
  );

  const breakCompliance = evaluateBreakCompliance({
    rules: context.timeRules,
    grossWorkMinutes: grossMinutes,
    blocks: timelineBlocks,
    trackedBreakfast: {
      start: todayEntry.breakfast_start ?? null,
      end: todayEntry.breakfast_end ?? null,
    },
    trackedLunch: {
      start: todayEntry.lunch_start ?? null,
      end: todayEntry.lunch_end ?? null,
    },
    missingBreakfastReason,
    missingLunchReason,
  });

  const pauseLines = useMemo(() => {
    const lines: string[] = [];
    if (todayEntry.breakfast_start && todayEntry.breakfast_end) {
      lines.push(
        `Frühstück ${todayEntry.breakfast_start.slice(0, 5)}–${todayEntry.breakfast_end.slice(0, 5)}`,
      );
    }
    if (todayEntry.lunch_start && todayEntry.lunch_end) {
      lines.push(
        `Mittag ${todayEntry.lunch_start.slice(0, 5)}–${todayEntry.lunch_end.slice(0, 5)}`,
      );
    }
    return lines;
  }, [todayEntry]);

  const siteOptions = sites.map((site) => ({ value: site.id, label: site.name }));

  function submitClockOut() {
    setError(null);

    const validation = validateTimeline(timelineBlocks, dayStart, dayEnd, {
      requireFullCoverage: true,
    });
    if (!validation.ok) {
      setError(validation.errors[0] ?? 'Die Tagesaufteilung ist ungültig.');
      if (!timelineExpanded) setTimelineExpanded(true);
      return;
    }

    if (breakCompliance.missingBreakfastReasonRequired && !missingBreakfastReason.trim()) {
      setError('Bitte einen Grund für die fehlende Frühstückspause angeben.');
      return;
    }
    if (breakCompliance.missingLunchReasonRequired && !missingLunchReason.trim()) {
      setError('Bitte einen Grund für die fehlende Mittagspause angeben.');
      return;
    }

    const payload: ClockOutPayload = {
      driverTrip,
      badWeatherClaimed: context.isBadWeatherSeason ? badWeatherClaimed : false,
      segments: timelineBlocks,
      missingBreakfastReason: missingBreakfastReason.trim() || null,
      missingLunchReason: missingLunchReason.trim() || null,
    };

    startTransition(async () => {
      try {
        await clockOutWork(undefined, payload);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler');
      }
    });
  }

  const netLabel =
    timelinePreview.ok || timelinePreview.workMinutes > 0
      ? formatMinutes(timelinePreview.workMinutes)
      : '–';

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Feierabend"
      panelClassName="dialog-panel--wide dialog-panel--fixed dialog-panel--clock-out"
      footer={
        <div className="dialog-actions dialog-actions--clock-out">
          {breakCompliance.missingBreakfastReasonRequired && (
            <label className="dialog-field dialog-field--footer">
              Grund fehlendes Frühstück (Pflicht)
              <textarea
                rows={2}
                value={missingBreakfastReason}
                onChange={(event) => setMissingBreakfastReason(event.target.value)}
              />
            </label>
          )}
          {breakCompliance.missingLunchReasonRequired && (
            <label className="dialog-field dialog-field--footer">
              Grund fehlende Mittagspause (Pflicht)
              <textarea
                rows={2}
                value={missingLunchReason}
                onChange={(event) => setMissingLunchReason(event.target.value)}
              />
            </label>
          )}
          {error ? <p className="dialog-error dialog-error--footer">{error}</p> : null}
          <div className="dialog-actions-row">
            <button type="button" className="text-button" onClick={onClose} disabled={pending}>
              Abbrechen
            </button>
            <button
              type="button"
              className="primary-button primary-button--clock-out-save"
              disabled={pending}
              onClick={submitClockOut}
            >
              {pending ? 'Speichern…' : 'Feierabend speichern'}
            </button>
          </div>
        </div>
      }
    >
      <div className="clock-out-summary">
        <div className="clock-out-summary-row">
          <span className="clock-out-summary-label">Beginn</span>
          <strong>{dayStart || '–'}</strong>
        </div>
        <div className="clock-out-summary-row">
          <span className="clock-out-summary-label">Feierabend</span>
          <strong>{dayEnd || '–'}</strong>
        </div>
        {pauseLines.length > 0 ? (
          <div className="clock-out-summary-row clock-out-summary-row--stack">
            <span className="clock-out-summary-label">Pausen</span>
            <span>{pauseLines.join(' · ')}</span>
          </div>
        ) : null}
        <div className="clock-out-summary-row clock-out-summary-row--highlight">
          <span className="clock-out-summary-label">Arbeitszeit</span>
          <strong>{netLabel}</strong>
        </div>
      </div>

      <div className="dialog-field">
        <span className="clock-out-summary-label">Baustelle heute</span>
        <AppSelect
          value={primarySiteId}
          onValueChange={handlePrimarySiteChange}
          options={siteOptions}
          placeholder="Baustelle wählen"
        />
        <p className="muted clock-out-hint">
          Für die meisten Tage reicht die Baustelle — Wegezeiten oder mehrere Baustellen nur bei Bedarf
          anpassen.
        </p>
      </div>

      <div className="dialog-field">
        <span className="clock-out-summary-label">Fahrt als Fahrer</span>
        <DriverTripSelect value={driverTrip} onValueChange={setDriverTrip} />
        <p className="muted clock-out-hint">Zuschlag nach Freigabe — Hin/Zurück jeweils 50 %.</p>
      </div>

      <div className="clock-out-toggles">
        {context.isBadWeatherSeason ? (
          <label className="clock-out-toggle input-form-checkbox">
            <input
              type="checkbox"
              checked={badWeatherClaimed}
              onChange={(event) => setBadWeatherClaimed(event.target.checked)}
            />
            <span>Schlechtwetter (KUG) — Saison {context.badWeatherSeasonLabel}</span>
          </label>
        ) : null}
      </div>

      <details
        className="clock-out-timeline-details"
        open={timelineExpanded}
        onToggle={(event) => setTimelineExpanded((event.target as HTMLDetailsElement).open)}
      >
        <summary>Tagesaufteilung anpassen</summary>
        <TimeEntryTimelineFields
          key={`tl-${primarySiteId}-${dayStart}-${dayEnd}`}
          variant="compact"
          sites={sites}
          dayStart={dayStart}
          dayEnd={dayEnd}
          initialBlocks={timelineBlocks}
          onChange={handleTimelineChange}
          defaultSiteId={primarySiteId || null}
        />
      </details>

      {!timelineExpanded && !timelinePreview.ok && timelineBlocks.length > 0 ? (
        <p className="muted">
          Hinweis: Die Aufteilung ist noch unvollständig — zum Anpassen aufklappen oder Baustelle wählen.
        </p>
      ) : null}
    </AppDialog>
  );
}
