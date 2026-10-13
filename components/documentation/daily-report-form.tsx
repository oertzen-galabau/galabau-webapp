'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  loadReportWeatherByGeolocation,
  loadReportWeatherForSite,
  type ReportWeatherResult,
} from '@/lib/documentation/load-report-weather';
import { formatSiteAddress, hasSiteAddress } from '@/lib/sites/format-address';
import { useRouter } from 'next/navigation';
import { saveDailyReport } from '@/lib/actions/daily-report';
import type { DailyLogDictationDraft } from '@/lib/ai/daily-log-dictation';
import { MIN_REPORT_PHOTOS, REPORT_UNIT_OPTIONS } from '@/lib/types/database';
import { AppSelect } from '@/components/ui/app-select';
import { DictationRecorder } from '@/components/documentation/dictation-recorder';
import { ReportPhotoManager } from '@/components/documentation/report-photo-manager';
import { SignaturePadField } from '@/components/documentation/signature-pad-field';
import type { BusinessPartnerFieldOption } from '@/components/documentation/business-partner-field';
import { DeliveryNoteBlockFields } from '@/components/documentation/delivery-note-block-fields';
import { partnerOptionLabel } from '@/lib/partners/kind';
import {
  DEFAULT_DAILY_LOG_REPORT_TYPE,
  isHourlyWageRapport,
  parseDailyLogReportType,
  shortLabelForReportType,
  type DailyLogReportType,
  type TenantReportLabelConfig,
} from '@/lib/documentation/report-labels';
import { appendSubcontractorGroupsToFormData } from '@/lib/documentation/subcontractor-groups';

type SiteOption = {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
  latitude: number | null;
  longitude: number | null;
};

type EmployeeOption = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
};

type WorkerRow = { id: number; userId: string; workerName: string; jobTitle: string; hours: string };
type WorkRow = { id: number; description: string; quantity: string; unit: string };
type ResourceRow = { id: number; name: string; quantity: string; unit: string; hours: string };
type SubcontractorWorkerRow = { id: number; workerName: string; hours: string };
type SubcontractorGroup = {
  id: number;
  groupKey: string;
  partnerId: string;
  companyName: string;
  workDescription: string;
  workers: SubcontractorWorkerRow[];
};

type ExistingPhoto = { id: string; url: string };
type ExistingSignature = {
  role: 'contractor' | 'client';
  signerName: string | null;
  url: string | null;
  signedAt: string | null;
  signedLatitude: number | null;
  signedLongitude: number | null;
  signedLocationLabel: string | null;
};

export type DailyReportFormInitial = {
  dailyLogId?: string;
  reportType?: DailyLogReportType;
  customTitle?: string | null;
  siteId?: string;
  logDate?: string;
  weather?: string;
  notes?: string;
  workers?: Array<{ userId: string | null; workerName: string; jobTitle: string | null; hours: number }>;
  workItems?: Array<{ description: string; quantity: number | null; unit: string | null }>;
  resources?: Array<{ name: string; quantity: number | null; unit: string | null; hours: number | null }>;
  photos?: ExistingPhoto[];
  signatures?: ExistingSignature[];
  dictationTranscript?: string | null;
  dictationExtraction?: Record<string, unknown> | null;
  subcontractorGroups?: Array<{
    groupKey: string;
    partnerId: string | null;
    companyName: string;
    workDescription: string | null;
    workers: Array<{ workerName: string | null; hours: number }>;
  }>;
};

type Props = {
  sites: SiteOption[];
  employees: EmployeeOption[];
  canDictate: boolean;
  dictationConfigured: boolean;
  initial?: DailyReportFormInitial;
  defaultReportType?: DailyLogReportType;
  reportLabels?: TenantReportLabelConfig;
  subcontractorPartners?: BusinessPartnerFieldOption[];
  supplierPartners?: BusinessPartnerFieldOption[];
};

let nextRowId = 1;
function createRowId() {
  return nextRowId++;
}

function weatherHintForResult(result: Extract<ReportWeatherResult, { ok: false }>): string {
  switch (result.reason) {
    case 'out_of_range':
      return 'Für dieses Datum keine automatische Wettervorlage — bitte manuell eintragen.';
    case 'geolocation_denied':
      return 'Standort nicht verfügbar — Wetter bitte manuell eintragen.';
    default:
      return 'Wetter konnte nicht ermittelt werden.';
  }
}

function createWorkerRow(partial?: Partial<WorkerRow>): WorkerRow {
  return {
    id: createRowId(),
    userId: partial?.userId ?? '',
    workerName: partial?.workerName ?? '',
    jobTitle: partial?.jobTitle ?? '',
    hours: partial?.hours ?? '',
  };
}

function createWorkRow(partial?: Partial<WorkRow>): WorkRow {
  return {
    id: createRowId(),
    description: partial?.description ?? '',
    quantity: partial?.quantity ?? '',
    unit: partial?.unit ?? '',
  };
}

function createResourceRow(partial?: Partial<ResourceRow>): ResourceRow {
  return {
    id: createRowId(),
    name: partial?.name ?? '',
    quantity: partial?.quantity ?? '',
    unit: partial?.unit ?? '',
    hours: partial?.hours ?? '',
  };
}

function createSubcontractorGroupKey() {
  return crypto.randomUUID();
}

function createSubcontractorWorkerRow(partial?: Partial<SubcontractorWorkerRow>): SubcontractorWorkerRow {
  return {
    id: createRowId(),
    workerName: partial?.workerName ?? '',
    hours: partial?.hours ?? '',
  };
}

function createSubcontractorGroup(partial?: Partial<Omit<SubcontractorGroup, 'id'>>): SubcontractorGroup {
  return {
    id: createRowId(),
    groupKey: partial?.groupKey ?? createSubcontractorGroupKey(),
    partnerId: partial?.partnerId ?? '',
    companyName: partial?.companyName ?? '',
    workDescription: partial?.workDescription ?? '',
    workers: partial?.workers ?? [createSubcontractorWorkerRow()],
  };
}

function subcontractorGroupStats(workers: SubcontractorWorkerRow[]) {
  const active = workers.filter((w) => w.workerName.trim() || Number(w.hours) > 0);
  const totalHours = active.reduce((sum, w) => sum + (Number(w.hours) || 0), 0);
  return { count: active.length, totalHours };
}

function unitOptions(current = '') {
  const values = new Set<string>([...REPORT_UNIT_OPTIONS]);
  if (current) values.add(current);
  return [...values].map((value) => ({ value, label: value }));
}

export function DailyReportForm({
  sites,
  employees,
  canDictate,
  dictationConfigured,
  initial,
  defaultReportType = DEFAULT_DAILY_LOG_REPORT_TYPE,
  reportLabels,
  subcontractorPartners = [],
  supplierPartners = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dictationMessage, setDictationMessage] = useState<string | null>(null);

  const lockedReportType = initial?.dailyLogId
    ? parseDailyLogReportType(initial.reportType)
    : null;
  const [reportType, setReportType] = useState<DailyLogReportType>(
    lockedReportType ?? parseDailyLogReportType(defaultReportType),
  );
  const hourlyRapport = isHourlyWageRapport(reportType);
  const dailyReportLabel = shortLabelForReportType('daily_report', reportLabels);
  const hourlyRapportLabel = shortLabelForReportType('hourly_wage_rapport', reportLabels);

  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? '');
  const [logDate, setLogDate] = useState(initial?.logDate ?? new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(initial?.weather ?? '');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherHint, setWeatherHint] = useState<string | null>(null);
  const [weatherReloadNonce, setWeatherReloadNonce] = useState(0);
  const [geoLocationLabel, setGeoLocationLabel] = useState<string | null>(null);
  const weatherTouchedRef = useRef(Boolean(initial?.weather?.trim()));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [dictationTranscript, setDictationTranscript] = useState(initial?.dictationTranscript ?? '');
  const [dictationExtraction, setDictationExtraction] = useState(
    initial?.dictationExtraction ? JSON.stringify(initial.dictationExtraction) : '',
  );

  const [workers, setWorkers] = useState<WorkerRow[]>(() =>
    initial?.workers?.length
      ? initial.workers.map((row) =>
          createWorkerRow({
            userId: row.userId ?? '',
            workerName: row.workerName,
            jobTitle: row.jobTitle ?? '',
            hours: String(row.hours ?? ''),
          }),
        )
      : [createWorkerRow()],
  );
  const [workItems, setWorkItems] = useState<WorkRow[]>(() =>
    initial?.workItems?.length
      ? initial.workItems.map((row) =>
          createWorkRow({
            description: row.description,
            quantity: row.quantity != null ? String(row.quantity) : '',
            unit: row.unit ?? '',
          }),
        )
      : [createWorkRow()],
  );
  const [resources, setResources] = useState<ResourceRow[]>(() =>
    initial?.resources?.length
      ? initial.resources.map((row) =>
          createResourceRow({
            name: row.name,
            quantity: row.quantity != null ? String(row.quantity) : '',
            unit: row.unit ?? '',
            hours: row.hours != null ? String(row.hours) : '',
          }),
        )
      : [createResourceRow()],
  );
  const [subcontractorGroups, setSubcontractorGroups] = useState<SubcontractorGroup[]>(() =>
    initial?.subcontractorGroups?.length
      ? initial.subcontractorGroups.map((group) =>
          createSubcontractorGroup({
            groupKey: group.groupKey,
            partnerId: group.partnerId ?? '',
            companyName: group.companyName,
            workDescription: group.workDescription ?? '',
            workers: group.workers.length
              ? group.workers.map((w) =>
                  createSubcontractorWorkerRow({
                    workerName: w.workerName ?? '',
                    hours: String(w.hours ?? ''),
                  }),
                )
              : [createSubcontractorWorkerRow()],
          }),
        )
      : [createSubcontractorGroup()],
  );
  const [deliveryBlocks, setDeliveryBlocks] = useState<{ id: number }[]>([]);

  const selectedSite = useMemo(() => sites.find((site) => site.id === siteId) ?? null, [siteId, sites]);

  const formattedSiteAddress = selectedSite ? formatSiteAddress(selectedSite) : null;

  const addressLabel = useMemo(() => {
    if (!selectedSite) return null;
    if (formattedSiteAddress) return formattedSiteAddress;
    if (geoLocationLabel) return geoLocationLabel;
    return 'Aktueller Standort';
  }, [selectedSite, formattedSiteAddress, geoLocationLabel]);

  useEffect(() => {
    if (!selectedSite) return;

    const skipBecauseEditing =
      Boolean(initial?.dailyLogId) &&
      Boolean(initial?.weather?.trim()) &&
      selectedSite.id === (initial?.siteId ?? '') &&
      logDate === (initial?.logDate ?? '') &&
      weatherReloadNonce === 0;
    if (skipBecauseEditing) return;

    let cancelled = false;

    async function loadWeather() {
      setWeatherLoading(true);
      setWeatherHint(null);

      try {
        const useSiteApi = hasSiteAddress(selectedSite!);
        if (useSiteApi) {
          setGeoLocationLabel(null);
        }

        const result = useSiteApi
          ? await loadReportWeatherForSite(selectedSite!, logDate)
          : await loadReportWeatherByGeolocation(logDate);

        if (cancelled) return;

        if (result.ok) {
          if (result.locationLabel) {
            setGeoLocationLabel(result.locationLabel);
          }
          if (!weatherTouchedRef.current) {
            setWeather(result.weatherText);
          }
          return;
        }

        setWeatherHint(weatherHintForResult(result));
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [selectedSite, logDate, initial?.dailyLogId, initial?.weather, initial?.siteId, initial?.logDate, weatherReloadNonce]);

  function reloadWeatherTemplate() {
    weatherTouchedRef.current = false;
    setWeatherReloadNonce((value) => value + 1);
  }
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const contractorSignature = initial?.signatures?.find((entry) => entry.role === 'contractor');
  const clientSignature = initial?.signatures?.find((entry) => entry.role === 'client');

  function applyDictationDraft(draft: DailyLogDictationDraft) {
    setDictationTranscript(draft.transcript);
    setDictationExtraction(JSON.stringify(draft));
    if (draft.weather) {
      weatherTouchedRef.current = true;
      setWeather(draft.weather);
    }
    if (draft.notes) setNotes((current) => (current ? `${current}\n${draft.notes}` : draft.notes ?? ''));

    if (hourlyRapport && draft.workers.length > 0) {
      setWorkers(
        draft.workers.map((worker) =>
          createWorkerRow({
            userId: worker.matchedUserId ?? '',
            workerName: worker.name,
            jobTitle: worker.jobTitle ?? '',
            hours: String(worker.hours),
          }),
        ),
      );
    }

    if (draft.workItems.length > 0) {
      setWorkItems(
        draft.workItems.map((item) =>
          createWorkRow({
            description: item.description,
            quantity: item.quantity != null ? String(item.quantity) : '',
            unit: item.unit ?? '',
          }),
        ),
      );
    }

    if (hourlyRapport && draft.resources.length > 0) {
      setResources(
        draft.resources.map((item) =>
          createResourceRow({
            name: item.name,
            quantity: item.quantity != null ? String(item.quantity) : '',
            unit: item.unit ?? '',
            hours: item.hours != null ? String(item.hours) : '',
          }),
        ),
      );
    }

    const lowMatches = hourlyRapport
      ? draft.workers.filter((worker) => worker.matchConfidence === 'low').length
      : 0;
    setDictationMessage(
      lowMatches > 0
        ? `Entwurf übernommen. ${lowMatches} Mitarbeiter-Zuordnung(en) bitte prüfen.`
        : 'Diktat-Entwurf übernommen – bitte vor dem Speichern prüfen.',
    );
  }

  function handleWorkerSelect(rowId: number, userId: string) {
    const employee = employeeById.get(userId);
    setWorkers((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              userId,
              workerName: employee ? `${employee.first_name} ${employee.last_name}`.trim() : row.workerName,
              jobTitle: employee?.job_title ?? row.jobTitle,
            }
          : row,
      ),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('site_id', siteId);
    formData.set('log_date', logDate);
    formData.set('weather', weather);
    formData.set('notes', notes);
    formData.set('report_type', reportType);
    if (initial?.dailyLogId) formData.set('daily_log_id', initial.dailyLogId);
    if (dictationTranscript) formData.set('dictation_transcript', dictationTranscript);
    if (dictationExtraction) formData.set('dictation_extraction', dictationExtraction);

    if (isHourlyWageRapport(reportType)) {
      appendSubcontractorGroupsToFormData(
        formData,
        subcontractorGroups.map((group) => ({
          groupKey: group.groupKey,
          partnerId: group.partnerId,
          companyName: group.companyName,
          workDescription: group.workDescription,
          workers: group.workers.map((worker) => ({
            workerName: worker.workerName,
            hours: worker.hours,
          })),
        })),
      );
    }

    startTransition(async () => {
      try {
        await saveDailyReport(formData);
        router.refresh();
        if (!initial?.dailyLogId) form.reset();
        setDictationMessage(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
      }
    });
  }

  return (
    <form className="input-form daily-report-form" onSubmit={handleSubmit}>
      {initial?.dailyLogId && <input type="hidden" name="daily_log_id" value={initial.dailyLogId} />}

      <section className="input-form-section">
        <h3 className="input-form-section-title">Berichtsart</h3>
        <div className="input-form-core daily-report-type-row">
          {lockedReportType ? (
            <>
              <input type="hidden" name="report_type" value={reportType} />
              <p className="muted input-form-span-full">
                {reportType === 'daily_report' ? dailyReportLabel : hourlyRapportLabel} — Art kann nachträglich nicht geändert werden.
              </p>
            </>
          ) : (
            <fieldset className="daily-report-type-fieldset input-form-span-full" role="radiogroup">
              <legend className="sr-only">Berichtsart wählen</legend>
              <button
                type="button"
                role="radio"
                aria-checked={reportType === 'daily_report'}
                className={`daily-report-type-option${reportType === 'daily_report' ? ' active' : ''}`}
                onClick={() => setReportType('daily_report')}
              >
                <span className="daily-report-type-option-body">
                  <strong>{dailyReportLabel}</strong>
                  <span className="muted">Wetter, Tätigkeiten, Fotos, Bemerkung — ohne Stunden und Unterschriften</span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={reportType === 'hourly_wage_rapport'}
                className={`daily-report-type-option${reportType === 'hourly_wage_rapport' ? ' active' : ''}`}
                onClick={() => setReportType('hourly_wage_rapport')}
              >
                <span className="daily-report-type-option-body">
                  <strong>{hourlyRapportLabel}</strong>
                  <span className="muted">Stunden, Leistung, Maschine/Material, Unterschriften</span>
                </span>
              </button>
            </fieldset>
          )}
        </div>
      </section>

      {canDictate && (
        <section className="input-form-section report-dictation-section">
          <DictationRecorder
            configured={dictationConfigured}
            disabled={pending}
            onDraft={applyDictationDraft}
            onError={(message) => {
              setDictationMessage(null);
              setError(message);
            }}
          />
          {dictationMessage && <p className="form-success">{dictationMessage}</p>}
        </section>
      )}

      <section className="input-form-section">
        <h3 className="input-form-section-title">Kopfdaten</h3>
        <div className="input-form-core daily-report-core">
          <label>
            Baustelle
            <AppSelect
              name="site_id"
              value={siteId}
              onValueChange={setSiteId}
              required
              allowEmpty={false}
              options={sites.map((site) => ({ value: site.id, label: site.name }))}
            />
          </label>
          <label>
            Datum
            <input type="date" name="log_date" value={logDate} onChange={(event) => setLogDate(event.target.value)} required />
          </label>
          <label className="input-form-span-full">
            Wetter
            <div className="inline-actions" style={{ alignItems: 'stretch', gap: 8 }}>
              <input
                name="weather"
                value={weather}
                onChange={(event) => {
                  weatherTouchedRef.current = true;
                  setWeather(event.target.value);
                  setWeatherHint(null);
                }}
                placeholder={weatherLoading ? 'Wird ermittelt…' : 'z.B. 18°C, trocken'}
                aria-busy={weatherLoading}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="text-button"
                disabled={weatherLoading || !selectedSite}
                onClick={reloadWeatherTemplate}
              >
                Wetter aktualisieren
              </button>
            </div>
            {weatherHint && <span className="muted">{weatherHint}</span>}
          </label>
          <div className="daily-report-core-meta input-form-span-full">
            <div className="daily-report-readonly">
              <span className="daily-report-readonly-label">Auftraggeber</span>
              <strong>{selectedSite?.client_name ?? '—'}</strong>
            </div>
            <div className="daily-report-readonly">
              <span className="daily-report-readonly-label">Baustellenadresse</span>
              <strong>
                {addressLabel ?? formattedSiteAddress ?? (weatherLoading ? 'Wird ermittelt…' : '—')}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {hourlyRapport && (
      <section className="input-form-section">
        <h3 className="input-form-section-title">Lohn / Mitarbeiter</h3>
        <div className="input-form-work-equipment-rows">
          {workers.map((row, index) => (
            <div key={row.id} className="input-form-work-equipment-row daily-report-worker-row">
              <div className="daily-report-row-grid daily-report-row-grid--worker">
                <label>
                  Mitarbeiter
                  <AppSelect
                    value={row.userId}
                    onValueChange={(value) => handleWorkerSelect(row.id, value)}
                    allowEmpty
                    options={employees.map((employee) => ({
                      value: employee.id,
                      label: `${employee.first_name} ${employee.last_name}`.trim(),
                    }))}
                  />
                  <input type="hidden" name="worker_user_id[]" value={row.userId} />
                </label>
                <label>
                  Name
                  <input
                    name="worker_name[]"
                    value={row.workerName}
                    onChange={(event) =>
                      setWorkers((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, workerName: event.target.value } : entry)),
                      )
                    }
                    placeholder="Name"
                    required={!row.userId}
                  />
                </label>
                <label>
                  Berufsbezeichnung
                  <input
                    name="worker_job_title[]"
                    value={row.jobTitle}
                    onChange={(event) =>
                      setWorkers((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, jobTitle: event.target.value } : entry)),
                      )
                    }
                    placeholder="z.B. Vorarbeiter"
                  />
                </label>
                <label className="input-form-field--narrow">
                  Std.
                  <input
                    type="number"
                    step="0.25"
                    min={0}
                    inputMode="decimal"
                    name="worker_hours_row[]"
                    value={row.hours}
                    onChange={(event) =>
                      setWorkers((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, hours: event.target.value } : entry)),
                      )
                    }
                  />
                </label>
              </div>
              <div className="input-form-work-equipment-actions">
                <button type="button" className="input-form-row-action input-form-row-action--add" onClick={() => setWorkers((current) => {
                  const next = [...current];
                  next.splice(index + 1, 0, createWorkerRow());
                  return next;
                })} aria-label="Zeile hinzufügen">
                  <Plus size={20} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="input-form-row-action input-form-row-action--remove"
                  disabled={workers.length <= 1}
                  onClick={() => setWorkers((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== row.id)))}
                  aria-label="Zeile entfernen"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      <section className="input-form-section">
        <h3 className="input-form-section-title">
          {hourlyRapport ? 'Bezeichnung der Leistung' : 'Tätigkeiten / Leistung'}
        </h3>
        <div className="input-form-work-equipment-rows">
          {workItems.map((row, index) => (
            <div key={row.id} className="input-form-work-equipment-row">
              <div className="daily-report-row-grid daily-report-row-grid--work">
                <label>
                  Leistung
                  <input
                    name="work_description[]"
                    value={row.description}
                    onChange={(event) =>
                      setWorkItems((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, description: event.target.value } : entry)),
                      )
                    }
                    placeholder="Geleistete Arbeit"
                  />
                </label>
                <label className="input-form-field--narrow">
                  Menge
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    name="work_quantity[]"
                    value={row.quantity}
                    onChange={(event) =>
                      setWorkItems((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, quantity: event.target.value } : entry)),
                      )
                    }
                  />
                </label>
                <label>
                  Einheit
                  <AppSelect
                    value={row.unit}
                    onValueChange={(value) =>
                      setWorkItems((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, unit: value } : entry)),
                      )
                    }
                    allowEmpty
                    options={unitOptions(row.unit)}
                  />
                  <input type="hidden" name="work_unit[]" value={row.unit} />
                </label>
              </div>
              <div className="input-form-work-equipment-actions">
                <button type="button" className="input-form-row-action input-form-row-action--add" onClick={() => setWorkItems((current) => {
                  const next = [...current];
                  next.splice(index + 1, 0, createWorkRow());
                  return next;
                })} aria-label="Zeile hinzufügen">
                  <Plus size={20} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="input-form-row-action input-form-row-action--remove"
                  disabled={workItems.length <= 1}
                  onClick={() => setWorkItems((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== row.id)))}
                  aria-label="Zeile entfernen"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {hourlyRapport && (
      <section className="input-form-section">
        <h3 className="input-form-section-title">Maschine / Material</h3>
        <div className="input-form-work-equipment-rows">
          {resources.map((row, index) => (
            <div key={row.id} className="input-form-work-equipment-row">
              <div className="daily-report-row-grid daily-report-row-grid--resource">
                <label>
                  Bezeichnung
                  <input
                    name="resource_name[]"
                    value={row.name}
                    onChange={(event) =>
                      setResources((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, name: event.target.value } : entry)),
                      )
                    }
                    placeholder="Maschine, Gerät, Material, Transport"
                  />
                </label>
                <label className="input-form-field--narrow">
                  Menge
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    name="resource_quantity[]"
                    value={row.quantity}
                    onChange={(event) =>
                      setResources((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, quantity: event.target.value } : entry)),
                      )
                    }
                  />
                </label>
                <label>
                  Einheit
                  <AppSelect
                    value={row.unit}
                    onValueChange={(value) =>
                      setResources((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, unit: value } : entry)),
                      )
                    }
                    allowEmpty
                    options={unitOptions(row.unit)}
                  />
                  <input type="hidden" name="resource_unit[]" value={row.unit} />
                </label>
                <label className="input-form-field--narrow">
                  Std.
                  <input
                    type="number"
                    step="0.25"
                    min={0}
                    inputMode="decimal"
                    name="resource_hours[]"
                    value={row.hours}
                    onChange={(event) =>
                      setResources((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, hours: event.target.value } : entry)),
                      )
                    }
                  />
                </label>
              </div>
              <div className="input-form-work-equipment-actions">
                <button type="button" className="input-form-row-action input-form-row-action--add" onClick={() => setResources((current) => {
                  const next = [...current];
                  next.splice(index + 1, 0, createResourceRow());
                  return next;
                })} aria-label="Zeile hinzufügen">
                  <Plus size={20} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="input-form-row-action input-form-row-action--remove"
                  disabled={resources.length <= 1}
                  onClick={() => setResources((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== row.id)))}
                  aria-label="Zeile entfernen"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {hourlyRapport && (
      <section className="input-form-section">
        <h3 className="input-form-section-title">Subunternehmer</h3>
        <p className="muted input-form-span-full" style={{ marginTop: 0 }}>
          Pro Subunternehmer eine Gruppe: Firma und Gewerk, darunter je Person Name und Std. — Anzahl MA und Std. gesamt werden automatisch summiert.
        </p>
        <div className="subcontractor-groups-stack">
          {subcontractorGroups.map((group, groupIndex) => {
            const stats = subcontractorGroupStats(group.workers);
            return (
              <div key={group.id} className="subcontractor-group panel form-panel--compact">
                <div className="input-form-core daily-report-row-grid daily-report-row-grid--subcontractor-head">
                  <label>
                    Subunternehmer
                    <AppSelect
                      value={group.partnerId}
                      onValueChange={(value) =>
                        setSubcontractorGroups((current) =>
                          current.map((entry) => {
                            if (entry.id !== group.id) return entry;
                            const partner = subcontractorPartners.find((p) => p.id === value);
                            return {
                              ...entry,
                              partnerId: value,
                              companyName:
                                partner && !entry.companyName.trim()
                                  ? partner.name
                                  : entry.companyName,
                            };
                          }),
                        )
                      }
                      allowEmpty
                      placeholder="— Freitext —"
                      options={subcontractorPartners.map((partner) => ({
                        value: partner.id,
                        label: partnerOptionLabel(partner),
                      }))}
                    />
                  </label>
                  <label>
                    Firma (Freitext)
                    <input
                      value={group.companyName}
                      onChange={(event) =>
                        setSubcontractorGroups((current) =>
                          current.map((entry) =>
                            entry.id === group.id ? { ...entry, companyName: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Subunternehmer"
                    />
                  </label>
                  <label>
                    Gewerk / Beschreibung
                    <input
                      value={group.workDescription}
                      onChange={(event) =>
                        setSubcontractorGroups((current) =>
                          current.map((entry) =>
                            entry.id === group.id ? { ...entry, workDescription: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="z.B. Pflasterarbeiten"
                    />
                  </label>
                </div>
                <p className="muted subcontractor-group-stats">
                  {stats.count} MA · {stats.totalHours.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Std. gesamt
                </p>
                <div className="input-form-work-equipment-rows">
                  {group.workers.map((worker, workerIndex) => (
                    <div key={worker.id} className="input-form-work-equipment-row">
                      <div className="daily-report-row-grid daily-report-row-grid--worker">
                        <label>
                          Person
                          <input
                            value={worker.workerName}
                            onChange={(event) =>
                              setSubcontractorGroups((current) =>
                                current.map((entry) =>
                                  entry.id === group.id
                                    ? {
                                        ...entry,
                                        workers: entry.workers.map((w) =>
                                          w.id === worker.id ? { ...w, workerName: event.target.value } : w,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Name"
                          />
                        </label>
                        <label className="input-form-field--narrow">
                          Std.
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            inputMode="decimal"
                            value={worker.hours}
                            onChange={(event) =>
                              setSubcontractorGroups((current) =>
                                current.map((entry) =>
                                  entry.id === group.id
                                    ? {
                                        ...entry,
                                        workers: entry.workers.map((w) =>
                                          w.id === worker.id ? { ...w, hours: event.target.value } : w,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                      <div className="input-form-work-equipment-actions">
                        <button
                          type="button"
                          className="input-form-row-action input-form-row-action--add"
                          onClick={() =>
                            setSubcontractorGroups((current) =>
                              current.map((entry) => {
                                if (entry.id !== group.id) return entry;
                                const nextWorkers = [...entry.workers];
                                nextWorkers.splice(workerIndex + 1, 0, createSubcontractorWorkerRow());
                                return { ...entry, workers: nextWorkers };
                              }),
                            )
                          }
                          aria-label="Person hinzufügen"
                        >
                          <Plus size={20} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          className="input-form-row-action input-form-row-action--remove"
                          onClick={() =>
                            setSubcontractorGroups((current) =>
                              current.map((entry) => {
                                if (entry.id !== group.id) return entry;
                                const nextWorkers =
                                  entry.workers.length <= 1
                                    ? [createSubcontractorWorkerRow()]
                                    : entry.workers.filter((w) => w.id !== worker.id);
                                return { ...entry, workers: nextWorkers };
                              }),
                            )
                          }
                          aria-label="Person entfernen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="subcontractor-group-actions">
                  <button
                    type="button"
                    className="secondary-button secondary-button--compact"
                    onClick={() =>
                      setSubcontractorGroups((current) => {
                        const next = [...current];
                        next.splice(groupIndex + 1, 0, createSubcontractorGroup());
                        return next;
                      })
                    }
                  >
                    Weiteren Subunternehmer
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setSubcontractorGroups((current) =>
                        current.length <= 1 ? [createSubcontractorGroup()] : current.filter((g) => g.id !== group.id),
                      )
                    }
                  >
                    Gruppe entfernen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {!hourlyRapport && (
      <section className="input-form-section">
        <h3 className="input-form-section-title">Lieferungen <span className="report-optional-label">optional</span></h3>
        <p className="muted input-form-span-full" style={{ marginTop: 0 }}>
          Lieferungen können hier mit dem Tagesbericht gespeichert werden. Weitere Nachträge ohne Bericht: Bereich
          „Lieferung erfassen“ weiter unten.
        </p>
        <input type="hidden" name="delivery_block_count" value={deliveryBlocks.length} />
        {deliveryBlocks.length > 0 && (
          <div className="subcontractor-groups-stack">
            {deliveryBlocks.map((block, index) => (
              <div key={block.id} className="subcontractor-group panel form-panel--compact">
                <DeliveryNoteBlockFields
                  namePrefix={`delivery_${index}`}
                  suppliers={supplierPartners}
                  blockTitle={`Lieferung ${index + 1}`}
                />
                <div className="subcontractor-group-actions">
                  <button
                    type="button"
                    className="secondary-button secondary-button--compact"
                    onClick={() =>
                      setDeliveryBlocks((current) => current.filter((entry) => entry.id !== block.id))
                    }
                  >
                    Lieferung entfernen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="subcontractor-group-actions">
          <button
            type="button"
            className="secondary-button secondary-button--compact"
            onClick={() => setDeliveryBlocks((current) => [...current, { id: createRowId() }])}
          >
            Lieferung hinzufügen
          </button>
        </div>
      </section>
      )}

      <section className="input-form-section">
        <h3 className="input-form-section-title">Fotos</h3>
        <ReportPhotoManager existingPhotos={initial?.photos ?? []} />
        {!initial?.dailyLogId && (
          <p className="muted report-photo-create-hint">Beim ersten Speichern sind mindestens {MIN_REPORT_PHOTOS} Fotos erforderlich.</p>
        )}
      </section>

      <section className="input-form-section">
        <h3 className="input-form-section-title">Bemerkung <span className="report-optional-label">optional</span></h3>
        <label className="input-form-span-full">
          <textarea name="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Zusätzliche Hinweise" />
        </label>
      </section>

      {hourlyRapport && (
      <section className="input-form-section">
        <h3 className="input-form-section-title">Unterschriften</h3>
        <div className="report-signatures-grid">
          <SignaturePadField
            role="contractor"
            label="Für den Auftragnehmer"
            defaultSignerName={contractorSignature?.signerName ?? ''}
            existingUrl={contractorSignature?.url ?? null}
            existingMetadata={
              contractorSignature
                ? {
                    signedAt: contractorSignature.signedAt,
                    signedLatitude: contractorSignature.signedLatitude,
                    signedLongitude: contractorSignature.signedLongitude,
                    signedLocationLabel: contractorSignature.signedLocationLabel,
                  }
                : undefined
            }
          />
          <SignaturePadField
            role="client"
            label="Für den Auftraggeber"
            defaultSignerName={clientSignature?.signerName ?? ''}
            existingUrl={clientSignature?.url ?? null}
            existingMetadata={
              clientSignature
                ? {
                    signedAt: clientSignature.signedAt,
                    signedLatitude: clientSignature.signedLatitude,
                    signedLongitude: clientSignature.signedLongitude,
                    signedLocationLabel: clientSignature.signedLocationLabel,
                  }
                : undefined
            }
          />
        </div>
      </section>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="input-form-actions daily-report-form-actions">
        <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
          {pending
            ? 'Speichert…'
            : initial?.dailyLogId
              ? 'Bericht aktualisieren'
              : hourlyRapport
                ? 'Rapport speichern'
                : 'Tagesbericht speichern'}
        </button>
      </div>
    </form>
  );
}
