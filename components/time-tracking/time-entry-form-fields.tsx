'use client';

import { useState } from 'react';
import type { TimeEntry } from '@/lib/types/database';
import { TimeEntryTimelineFields, type SiteOption } from '@/components/time-tracking/time-entry-timeline-fields';
import { BadWeatherClaimField } from '@/components/time-tracking/bad-weather-claim-field';
import type { TimelineBlockInput } from '@/lib/time-tracking/timeline';
import { todayWorkDate } from '@/lib/time-tracking/work-day';
import { DriverTripSelect } from '@/components/time-tracking/driver-trip-select';

type Site = SiteOption;

type Props = {
  sites: Site[];
  entry?: TimeEntry | null;
  initialBlocks?: TimelineBlockInput[];
  submitLabel: string;
  minDate?: string;
  maxDate?: string;
  compact?: boolean;
  badWeatherSeasonStart?: string;
  badWeatherSeasonEnd?: string;
};

export function TimeEntryFormFields({
  sites,
  entry,
  initialBlocks,
  submitLabel,
  minDate,
  maxDate,
  compact = false,
  badWeatherSeasonStart,
  badWeatherSeasonEnd,
}: Props) {
  const today = todayWorkDate();
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? '07:00');
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? '16:00');

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
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
          required
        />
      </label>
      <label>Ende
        <input
          type="time"
          name="end_time"
          value={endTime}
          onChange={(event) => setEndTime(event.target.value)}
          required
        />
      </label>
    </>
  );

  const checkboxes = (
    <>
      <label>Fahrt als Fahrer
        <DriverTripSelect entry={entry} />
        <span className="muted input-form-field-hint">Zuschlag nach Freigabe</span>
      </label>
      {badWeatherSeasonStart && badWeatherSeasonEnd ? (
        <BadWeatherClaimField
          seasonStart={badWeatherSeasonStart}
          seasonEnd={badWeatherSeasonEnd}
          defaultClaimed={entry?.bad_weather_claimed === true}
          defaultWorkDate={entry?.work_date}
        />
      ) : null}
    </>
  );

  const extraFields = (
    <>
      <div className="input-form-span-full">
        <TimeEntryTimelineFields
          variant="compact"
          sites={sites}
          dayStart={startTime}
          dayEnd={endTime}
          initialBlocks={initialBlocks ?? []}
          syncKey={`${entry?.id ?? 'new'}-${startTime}-${endTime}`}
        />
      </div>
      <label>Grund fehlendes Frühstück
        <input
          type="text"
          name="missing_breakfast_reason"
          defaultValue={entry?.missing_breakfast_reason ?? ''}
          placeholder="Nur wenn Frühstück erwartet, aber nicht erfasst"
        />
      </label>
      <label>Grund fehlende Mittagspause
        <input
          type="text"
          name="missing_lunch_reason"
          defaultValue={entry?.missing_lunch_reason ?? ''}
          placeholder="Nur wenn Mittag erwartet, aber nicht erfasst"
        />
      </label>
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
          <summary>Baustellen-Aufteilung, Pausengründe & Notiz</summary>
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
        <summary>Baustellen-Aufteilung, Pausengründe & Notiz</summary>
        <div className="input-form-extra-grid">{extraFields}</div>
      </details>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">{submitLabel}</button>
      </div>
    </>
  );
}
