import type { TimeEntry } from '@/lib/types/database';
import { TimeEntrySegmentsFields, type SiteOption } from '@/components/time-tracking/time-entry-segments-fields';

type Site = SiteOption;

type Props = {
  sites: Site[];
  entry?: TimeEntry | null;
  initialSegments?: { siteId: string; travelMinutes: number }[];
  submitLabel: string;
  minDate?: string;
  maxDate?: string;
  compact?: boolean;
};

export function TimeEntryFormFields({
  sites,
  entry,
  initialSegments,
  submitLabel,
  minDate,
  maxDate,
  compact = false,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const segmentDefaults = initialSegments ?? (entry?.site_id
    ? [{
        siteId: entry.site_id,
        travelMinutes: entry.travel_minutes ?? 0,
      }]
    : []);

  const timeInputs = (
    <>
      <label>Datum
        <input
          type="date"
          name="work_date"
          defaultValue={entry?.work_date ?? today}
          min={minDate}
          max={maxDate}
          required
        />
      </label>
      <label>Start
        <input
          type="time"
          name="start_time"
          defaultValue={entry?.start_time?.slice(0, 5) ?? ''}
          required
        />
      </label>
      <label>Ende
        <input
          type="time"
          name="end_time"
          defaultValue={entry?.end_time?.slice(0, 5) ?? ''}
          required
        />
      </label>
    </>
  );

  const checkboxes = (
    <>
      <label className="input-form-checkbox">
        <input
          type="checkbox"
          name="is_driver"
          defaultChecked={entry?.is_driver === true}
        />
        Heute Fahrer (Zuschlag nach Freigabe)
      </label>
      <label className="input-form-checkbox">
        <input
          type="checkbox"
          name="bad_weather_claimed"
          defaultChecked={entry?.bad_weather_claimed === true}
        />
        Schlechtwetter (KUG) — am Standort
      </label>
    </>
  );

  const extraFields = (
    <>
      <label>Frühstück Start
        <input
          type="time"
          name="breakfast_start"
          defaultValue={entry?.breakfast_start?.slice(0, 5) ?? ''}
        />
      </label>
      <label>Frühstück Ende
        <input
          type="time"
          name="breakfast_end"
          defaultValue={entry?.breakfast_end?.slice(0, 5) ?? ''}
        />
      </label>
      <label>Mittag Start
        <input
          type="time"
          name="lunch_start"
          defaultValue={entry?.lunch_start?.slice(0, 5) ?? ''}
        />
      </label>
      <label>Mittag Ende
        <input
          type="time"
          name="lunch_end"
          defaultValue={entry?.lunch_end?.slice(0, 5) ?? ''}
        />
      </label>
      <div className="input-form-span-full">
        <TimeEntrySegmentsFields sites={sites} initialSegments={segmentDefaults} />
      </div>
      <label className="input-form-notes">Notiz
        <input
          type="text"
          name="notes"
          defaultValue={entry?.notes ?? ''}
          placeholder="Optional"
        />
      </label>
    </>
  );

  if (compact) {
    return (
      <>
        <div className="input-form-core input-form-core--time">{timeInputs}</div>
        <div className="input-form-checkboxes">{checkboxes}</div>
        <details className="input-form-extra">
          <summary>Pausen, Baustellen & Notiz</summary>
          <div className="input-form-extra-grid">{extraFields}</div>
        </details>
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">{submitLabel}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="input-form-core input-form-core--time">{timeInputs}</div>
      <div className="input-form-checkboxes">{checkboxes}</div>
      <details className="input-form-extra" open>
        <summary>Pausen, Baustellen & Notiz</summary>
        <div className="input-form-extra-grid">{extraFields}</div>
      </details>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">{submitLabel}</button>
      </div>
    </>
  );
}
