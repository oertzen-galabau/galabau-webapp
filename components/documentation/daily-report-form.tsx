'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { formatReportWeather } from '@/lib/weather/format-report-weather';
import { useRouter } from 'next/navigation';
import { saveDailyReport } from '@/lib/actions/daily-report';
import type { DailyLogDictationDraft } from '@/lib/ai/daily-log-dictation';
import { MIN_REPORT_PHOTOS, REPORT_UNIT_OPTIONS } from '@/lib/types/database';
import { AppSelect } from '@/components/ui/app-select';
import { DictationRecorder } from '@/components/documentation/dictation-recorder';
import { ReportPhotoManager } from '@/components/documentation/report-photo-manager';
import { SignaturePadField } from '@/components/documentation/signature-pad-field';
import {
  DEFAULT_DAILY_LOG_REPORT_TYPE,
  defaultTitleForReportType,
  isHourlyWageRapport,
  parseDailyLogReportType,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';

type SiteOption = {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
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
};

type Props = {
  sites: SiteOption[];
  employees: EmployeeOption[];
  canDictate: boolean;
  dictationConfigured: boolean;
  initial?: DailyReportFormInitial;
  defaultReportType?: DailyLogReportType;
};

let nextRowId = 1;
function createRowId() {
  return nextRowId++;
}

const GEO_TIMEOUT_MS = 10000;

function requestDevicePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation nicht verfügbar'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: GEO_TIMEOUT_MS,
      maximumAge: 10 * 60 * 1000,
    });
  });
}

async function fetchWeatherByCoords(lat: number, lng: number) {
  const response = await fetch(
    `/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
  );
  if (!response.ok) return null;
  return (await response.json()) as {
    temperature: number;
    label: string;
    location: string | null;
    weatherText?: string;
  };
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
  const [customTitle, setCustomTitle] = useState(initial?.customTitle ?? '');
  const hourlyRapport = isHourlyWageRapport(reportType);

  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? '');
  const [logDate, setLogDate] = useState(initial?.logDate ?? new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(initial?.weather ?? '');
  const [weatherLoading, setWeatherLoading] = useState(false);
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

  const selectedSite = useMemo(() => sites.find((site) => site.id === siteId) ?? null, [siteId, sites]);

  const addressLabel = useMemo(() => {
    if (!selectedSite) return null;
    if (selectedSite.address?.trim()) return selectedSite.address;
    if (geoLocationLabel) return geoLocationLabel;
    return 'Aktueller Standort';
  }, [selectedSite, geoLocationLabel]);

  useEffect(() => {
    if (!selectedSite) return;

    const skipBecauseEditing =
      Boolean(initial?.weather?.trim()) && selectedSite.id === (initial?.siteId ?? siteId);
    if (skipBecauseEditing) return;

    let cancelled = false;
    weatherTouchedRef.current = false;

    async function loadWeather() {
      setWeatherLoading(true);

      try {
        const hasAddress = Boolean(selectedSite!.address?.trim());

        if (!hasAddress) {
          setGeoLocationLabel(null);
        }

        if (hasAddress) {
          const response = await fetch(
            `/api/weather/site?siteId=${encodeURIComponent(selectedSite!.id)}`,
          );
          if (cancelled || !response.ok) return;

          const data = (await response.json()) as {
            temperature: number;
            label: string;
            weatherText?: string;
          };

          if (!weatherTouchedRef.current) {
            setWeather(data.weatherText ?? formatReportWeather(data.temperature, data.label));
          }
          return;
        }

        if (!window.isSecureContext) return;

        const position = await requestDevicePosition();
        if (cancelled) return;

        const result = await fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
        if (cancelled || !result) return;

        if (result.location) {
          setGeoLocationLabel(`Aktueller Standort (${result.location})`);
        } else {
          setGeoLocationLabel('Aktueller Standort');
        }

        if (!weatherTouchedRef.current) {
          setWeather(formatReportWeather(result.temperature, result.label));
        }
      } catch {
        // Standort verweigert oder Wetter nicht verfügbar
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [selectedSite, initial?.weather, initial?.siteId, siteId]);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const contractorSignature = initial?.signatures?.find((entry) => entry.role === 'contractor');
  const clientSignature = initial?.signatures?.find((entry) => entry.role === 'client');

  function applyDictationDraft(draft: DailyLogDictationDraft) {
    setDictationTranscript(draft.transcript);
    setDictationExtraction(JSON.stringify(draft));
    if (draft.weather) setWeather(draft.weather);
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
    formData.set('custom_title', customTitle);
    if (initial?.dailyLogId) formData.set('daily_log_id', initial.dailyLogId);
    if (dictationTranscript) formData.set('dictation_transcript', dictationTranscript);
    if (dictationExtraction) formData.set('dictation_extraction', dictationExtraction);

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
                {reportType === 'daily_report' ? 'Tagesbericht' : 'Std.-Lohnarbeit (Rapport)'} — Art kann nachträglich nicht geändert werden.
              </p>
            </>
          ) : (
            <fieldset className="daily-report-type-fieldset input-form-span-full">
              <legend className="sr-only">Berichtsart wählen</legend>
              <label className="daily-report-type-option">
                <input
                  type="radio"
                  name="report_type"
                  value="daily_report"
                  checked={reportType === 'daily_report'}
                  onChange={() => setReportType('daily_report')}
                />
                <span>
                  <strong>Tagesbericht</strong>
                  <span className="muted">Wetter, Tätigkeiten, Fotos, Bemerkung — ohne Stunden und Unterschriften</span>
                </span>
              </label>
              <label className="daily-report-type-option">
                <input
                  type="radio"
                  name="report_type"
                  value="hourly_wage_rapport"
                  checked={reportType === 'hourly_wage_rapport'}
                  onChange={() => setReportType('hourly_wage_rapport')}
                />
                <span>
                  <strong>Std.-Lohnarbeit (Rapport)</strong>
                  <span className="muted">Stunden, Leistung, Maschine/Material, Unterschriften</span>
                </span>
              </label>
            </fieldset>
          )}
          <label className="input-form-span-full">
            Titel <span className="report-optional-label">optional</span>
            <input
              name="custom_title"
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder={defaultTitleForReportType(reportType)}
            />
          </label>
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
          <label>
            Wetter
            <input
              name="weather"
              value={weather}
              onChange={(event) => {
                weatherTouchedRef.current = true;
                setWeather(event.target.value);
              }}
              placeholder={weatherLoading ? 'Wird ermittelt…' : 'z.B. 18°C, trocken'}
              aria-busy={weatherLoading}
            />
          </label>
          <div className="daily-report-core-meta input-form-span-full">
            <div className="daily-report-readonly">
              <span className="daily-report-readonly-label">Auftraggeber</span>
              <strong>{selectedSite?.client_name ?? '—'}</strong>
            </div>
            <div className="daily-report-readonly">
              <span className="daily-report-readonly-label">Baustellenadresse</span>
              <strong>
                {addressLabel ?? selectedSite?.address ?? (weatherLoading ? 'Wird ermittelt…' : '—')}
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
