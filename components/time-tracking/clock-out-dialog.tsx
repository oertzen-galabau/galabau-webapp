'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { AppDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';
import type { SiteOption } from '@/components/time-tracking/time-entry-timeline-fields';
import { clockOutWork, type ClockOutPayload } from '@/lib/actions/employee';
import type { TimeEntry, TimeBlockType } from '@/lib/types/database';
import { evaluateBreakCompliance } from '@/lib/time-tracking/break-rules';
import {
  primarySiteIdFromBlocks,
  validateTimeline,
  BLOCK_TYPE_LABELS,
} from '@/lib/time-tracking/timeline';
import { formatMinutes, parseTime } from '@/lib/utils/time';
import { toTimeString } from '@/lib/time-tracking/work-day';
import type { DriverTrip } from '@/lib/types/database';
import { DriverTripSelect } from '@/components/time-tracking/driver-trip-select';
import { DRIVER_TRIP_LABELS } from '@/lib/time-tracking/driver-trip';
import {
  buildDefaultPauseSelections,
  ClockOutIntervalConfirm,
  pausesNeedingConfirmation,
} from '@/components/time-tracking/clock-out-interval-confirm';
import { getClockOutContext } from '@/lib/actions/payroll';

export type ClockOutContext = Awaited<ReturnType<typeof getClockOutContext>>;

type Props = {
  open: boolean;
  onClose: () => void;
  todayEntry: TimeEntry;
  context: ClockOutContext | null;
  loading?: boolean;
};

type WizardStepId = 'pauses' | 'site' | 'extras' | 'summary';

const STEP_LABELS: Record<WizardStepId, string> = {
  pauses: 'Pausen',
  site: 'Baustelle',
  extras: 'Fahrt & Zusatz',
  summary: 'Zusammenfassung',
};

function formatDialogClockTime(value: string | null | undefined): string {
  if (!value) return '–';
  const raw = value.trim();
  if (raw.length >= 5) return raw.slice(0, 5);
  return raw;
}

function buildWizardSteps(intervals: ClockOutContext['intervals']): WizardStepId[] {
  const steps: WizardStepId[] = [];
  if (pausesNeedingConfirmation(intervals ?? []).length > 0) {
    steps.push('pauses');
  }
  steps.push('site', 'extras', 'summary');
  return steps;
}

export function ClockOutDialog({
  open,
  onClose,
  todayEntry,
  context,
  loading = false,
}: Props) {
  if (!open) return null;

  if (loading || !context) {
    return (
      <AppDialog
        open={open}
        onClose={onClose}
        title="Feierabend"
        panelClassName="dialog-panel--wide dialog-panel--fixed dialog-panel--clock-out"
      >
        <div className="dialog-loading-state" role="status" aria-live="polite">
          <InlineSpinner size={28} />
          <p>Feierabend wird vorbereitet …</p>
        </div>
      </AppDialog>
    );
  }

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
  const [stepIndex, setStepIndex] = useState(0);

  const dayStart = context.startTime ?? todayEntry.start_time?.slice(0, 5) ?? '';
  const dayEnd = context.endTime;
  const initialSiteId =
    context.assignedSiteId ?? primarySiteIdFromBlocks(context.defaultTimeline) ?? '';

  const [driverTrip, setDriverTrip] = useState<DriverTrip>('none');
  const [badWeatherClaimed, setBadWeatherClaimed] = useState(false);
  const [missingBreakfastReason, setMissingBreakfastReason] = useState('');
  const [missingLunchReason, setMissingLunchReason] = useState('');
  const [primarySiteId, setPrimarySiteId] = useState(initialSiteId);
  const [intervals] = useState(context.intervals ?? []);

  const timelineBlocks = context.defaultTimeline;

  const pauseSelectionsInitial = useMemo(
    () => buildDefaultPauseSelections(pausesNeedingConfirmation(intervals)),
    [intervals],
  );
  const [pauseSelections, setPauseSelections] =
    useState<Record<string, TimeBlockType>>(pauseSelectionsInitial);

  const wizardSteps = useMemo(() => buildWizardSteps(intervals), [intervals]);
  const currentStep = wizardSteps[stepIndex] ?? 'summary';
  const stepNumber = stepIndex + 1;
  const stepTotal = wizardSteps.length;

  const sites = context.sites as SiteOption[];
  const siteOptions = sites.map((site) => ({ value: site.id, label: site.name }));

  function handlePauseSelectionChange(intervalId: string, blockType: TimeBlockType) {
    setPauseSelections((prev) => ({ ...prev, [intervalId]: blockType }));
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

  const netLabel =
    timelinePreview.ok || timelinePreview.workMinutes > 0
      ? formatMinutes(timelinePreview.workMinutes)
      : '–';

  const pauseSummaryLines = useMemo(() => {
    const pauses = pausesNeedingConfirmation(intervals);
    if (pauses.length === 0) return [];
    return pauses.map((row) => {
      const start = toTimeString(new Date(row.started_at)).slice(0, 5);
      const end = row.ended_at
        ? toTimeString(new Date(row.ended_at)).slice(0, 5)
        : '–';
      const type = pauseSelections[row.id] ?? row.suggested_block_type ?? 'travel';
      return `${start}–${end} ${BLOCK_TYPE_LABELS[type]}`;
    });
  }, [intervals, pauseSelections]);

  const siteLabel = sites.find((s) => s.id === primarySiteId)?.name ?? '—';

  function validateStep(step: WizardStepId): string | null {
    if (step === 'site') {
      if (sites.length > 0 && !primarySiteId) {
        return 'Bitte eine Baustelle aus dem heutigen Einsatzplan wählen.';
      }
    }
    if (step === 'extras') {
      if (breakCompliance.missingBreakfastReasonRequired && !missingBreakfastReason.trim()) {
        return 'Bitte einen Grund für die fehlende Frühstückspause angeben.';
      }
      if (breakCompliance.missingLunchReasonRequired && !missingLunchReason.trim()) {
        return 'Bitte einen Grund für die fehlende Mittagspause angeben.';
      }
    }
    return null;
  }

  function validateSubmit(): string | null {
    const pauses = pausesNeedingConfirmation(intervals);
    if (pauses.length > 0) {
      for (const row of pauses) {
        if (!pauseSelections[row.id]) {
          return 'Bitte alle Pausen zuordnen.';
        }
      }
    }

    return validateStep('site') ?? validateStep('extras');
  }

  function goNext() {
    setError(null);
    const stepError = validateStep(currentStep);
    if (stepError) {
      setError(stepError);
      return;
    }
    if (stepIndex < wizardSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  }

  function goBack() {
    setError(null);
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  function submitClockOut() {
    setError(null);
    const submitError = validateSubmit();
    if (submitError) {
      setError(submitError);
      return;
    }

    const pauses = pausesNeedingConfirmation(intervals);
    const pauseConfirmations = pauses.map((row) => ({
      intervalId: row.id,
      blockType: pauseSelections[row.id] ?? row.suggested_block_type ?? 'travel',
    }));

    const payload: ClockOutPayload = {
      driverTrip,
      badWeatherClaimed: context.isBadWeatherSeason ? badWeatherClaimed : false,
      segments: [],
      primarySiteId: primarySiteId || null,
      missingBreakfastReason: missingBreakfastReason.trim() || null,
      missingLunchReason: missingLunchReason.trim() || null,
      pauseConfirmations,
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

  const isLastStep = stepIndex >= wizardSteps.length - 1;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Feierabend"
      panelClassName="dialog-panel--wide dialog-panel--fixed dialog-panel--clock-out"
      footer={
        <div className="dialog-actions dialog-actions--clock-out">
          {error ? <p className="dialog-error dialog-error--footer">{error}</p> : null}
          <div className="dialog-actions-row clock-out-wizard-footer">
            <button type="button" className="text-button" onClick={onClose} disabled={pending}>
              Abbrechen
            </button>
            <div className="clock-out-wizard-nav">
              {stepIndex > 0 ? (
                <button type="button" className="secondary-button" onClick={goBack} disabled={pending}>
                  Zurück
                </button>
              ) : null}
              {isLastStep ? (
                <button
                  type="button"
                  className="primary-button primary-button--clock-out-save"
                  disabled={pending}
                  onClick={submitClockOut}
                >
                  {pending ? 'Speichern…' : 'Feierabend speichern'}
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={goNext} disabled={pending}>
                  Weiter
                </button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="clock-out-wizard">
        <p className="clock-out-wizard-progress" aria-live="polite">
          Schritt {stepNumber} von {stepTotal}: {STEP_LABELS[currentStep]}
        </p>

        {currentStep === 'pauses' ? (
          <ClockOutIntervalConfirm
            intervals={intervals}
            selections={pauseSelections}
            onSelectionChange={handlePauseSelectionChange}
          />
        ) : null}

        {currentStep === 'site' ? (
          <div className="clock-out-step">
            <p className="clock-out-step-intro">
              {sites.length === 0
                ? 'Heute ist keine Baustelle im Einsatzplan hinterlegt. Du kannst trotzdem Feierabend speichern.'
                : 'Wähle die Baustelle für heute aus deinem Einsatzplan.'}
            </p>
            {sites.length > 0 ? (
              <div className="dialog-field">
                <span className="clock-out-summary-label">Baustelle heute</span>
                <AppSelect
                  value={primarySiteId}
                  onValueChange={setPrimarySiteId}
                  options={siteOptions}
                  placeholder="Baustelle wählen"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {currentStep === 'extras' ? (
          <div className="clock-out-step">
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
            {breakCompliance.missingBreakfastReasonRequired ? (
              <label className="dialog-field">
                Grund fehlendes Frühstück (Pflicht)
                <textarea
                  rows={2}
                  value={missingBreakfastReason}
                  onChange={(event) => setMissingBreakfastReason(event.target.value)}
                />
              </label>
            ) : null}
            {breakCompliance.missingLunchReasonRequired ? (
              <label className="dialog-field">
                Grund fehlende Mittagspause (Pflicht)
                <textarea
                  rows={2}
                  value={missingLunchReason}
                  onChange={(event) => setMissingLunchReason(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {currentStep === 'summary' ? (
          <div className="clock-out-step clock-out-summary-step">
            <div className="clock-out-summary-hero">
              <div>
                <span className="clock-out-summary-label">Beginn</span>
                <strong>{formatDialogClockTime(dayStart)}</strong>
              </div>
              <div>
                <span className="clock-out-summary-label">Feierabend</span>
                <strong>{formatDialogClockTime(dayEnd)}</strong>
              </div>
              <div className="clock-out-summary-hero-net">
                <span className="clock-out-summary-label">Arbeitszeit</span>
                <strong>{netLabel}</strong>
              </div>
            </div>
            {context.plannedStartTime ? (
              <p className="muted">
                Plan: {context.plannedStartTime}
                {context.earlyStartReason ? ` · Grund früher Start: ${context.earlyStartReason}` : ''}
              </p>
            ) : null}
            {pauseSummaryLines.length > 0 ? (
              <div className="clock-out-summary-block">
                <span className="clock-out-summary-label">Pausen</span>
                <ul className="clock-out-summary-list">
                  {pauseSummaryLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="clock-out-summary-block">
              <span className="clock-out-summary-label">Baustelle</span>
              <p>{siteLabel}</p>
            </div>
            <div className="clock-out-summary-block">
              <span className="clock-out-summary-label">Fahrt</span>
              <p>{DRIVER_TRIP_LABELS[driverTrip]}</p>
            </div>
            {badWeatherClaimed ? (
              <p className="muted">Schlechtwetter (KUG) gemeldet.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppDialog>
  );
}
