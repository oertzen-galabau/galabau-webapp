'use client';

import type { TimeBlockType, TimeEntryInterval } from '@/lib/types/database';
import { BLOCK_TYPE_LABELS } from '@/lib/time-tracking/timeline';
import { toTimeString } from '@/lib/time-tracking/work-day';

const CHIP_TYPES = ['travel', 'breakfast', 'lunch', 'other_work'] as const satisfies readonly TimeBlockType[];

export function pausesNeedingConfirmation(intervals: TimeEntryInterval[]): TimeEntryInterval[] {
  return intervals.filter(
    (row) => row.phase === 'pause' && row.ended_at && !row.confirmed_block_type,
  );
}

function pauseDurationMinutes(row: TimeEntryInterval): number {
  if (!row.ended_at) return 0;
  const start = Date.parse(row.started_at);
  const end = Date.parse(row.ended_at);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

export function buildDefaultPauseSelections(
  pauses: TimeEntryInterval[],
): Record<string, TimeBlockType> {
  const out: Record<string, TimeBlockType> = {};
  for (const row of pauses) {
    out[row.id] = row.suggested_block_type ?? 'travel';
  }
  return out;
}

type Props = {
  intervals: TimeEntryInterval[];
  selections: Record<string, TimeBlockType>;
  onSelectionChange: (intervalId: string, blockType: TimeBlockType) => void;
};

export function ClockOutIntervalConfirm({ intervals, selections, onSelectionChange }: Props) {
  const pauses = pausesNeedingConfirmation(intervals);
  if (pauses.length === 0) return null;

  return (
    <div className="clock-out-pause-step">
      <p className="clock-out-step-intro">
        Ordne jede Pause zu. Der Vorschlag ist vorausgewählt — du kannst ihn anpassen. Beim Speichern
        werden alle Auswahlen übernommen.
      </p>
      <ul className="clock-out-pause-cards">
        {pauses.map((row) => {
          const start = toTimeString(new Date(row.started_at)).slice(0, 5);
          const end = row.ended_at
            ? toTimeString(new Date(row.ended_at)).slice(0, 5)
            : '–';
          const minutes = pauseDurationMinutes(row);
          const suggested = row.suggested_block_type ?? 'travel';
          const selected = selections[row.id] ?? suggested;

          return (
            <li key={row.id} className="clock-out-pause-card">
              <div className="clock-out-pause-card-head">
                <strong>
                  {start}–{end}
                </strong>
                <span className="clock-out-pause-card-meta">
                  {minutes} Min.
                  {minutes > 0 && minutes < 2 ? (
                    <span className="clock-out-pause-short"> · kurz</span>
                  ) : null}
                </span>
              </div>
              {row.suggested_block_type ? (
                <p className="muted clock-out-pause-suggest">
                  Vorschlag: {BLOCK_TYPE_LABELS[suggested]}
                </p>
              ) : null}
              <div className="clock-out-pause-chips" role="group" aria-label={`Pause ${start} bis ${end}`}>
                {CHIP_TYPES.map((type) => {
                  const active = selected === type;
                  const isSuggested = suggested === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`clock-out-pause-chip${active ? ' clock-out-pause-chip--active' : ''}${
                        isSuggested ? ' clock-out-pause-chip--suggested' : ''
                      }`}
                      aria-pressed={active}
                      onClick={() => onSelectionChange(row.id, type)}
                    >
                      {BLOCK_TYPE_LABELS[type]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
