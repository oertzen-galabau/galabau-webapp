'use client';

import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import { scheduleEntryPhase } from '@/lib/schedule/entry-phase';
import {
  DAY_TIMELINE_END_HOUR,
  DAY_TIMELINE_PX_PER_HOUR,
  DAY_TIMELINE_START_HOUR,
  dayTimelineGridHeightPx,
  formatTimelineHourLabel,
  layoutDayTimelineColumns,
  nowLinePercent,
} from '@/lib/schedule/day-timeline';

type Props = {
  entries: ScheduleEntryView[];
  selectedDay: string;
  now: Date;
  canManage: boolean;
  conflictEntryIds: Set<string>;
  onEdit: (entry: ScheduleEntryView) => void;
};

function siteLocationLine(site: ScheduleEntryView['site']): string | null {
  const cityLine = [site.zip_code, site.city].filter(Boolean).join(' ');
  const street = site.street?.trim() || site.address?.trim() || '';
  const line = [street, cityLine].filter(Boolean).join(', ');
  return line || null;
}

function memberLine(entry: ScheduleEntryView): string {
  const names = entry.members
    .map((m) => `${m.first_name} ${m.last_name.charAt(0)}.`)
    .join(', ');
  const parts = [names, entry.external_workers_text?.trim()].filter(Boolean);
  return parts.join(' · ') || '—';
}

function entryCardClassName(
  entry: ScheduleEntryView,
  conflict: boolean,
  now: Date,
): string {
  const phase = scheduleEntryPhase(entry, now);
  return [
    'schedule-day-timeline-event',
    'schedule-entry-card',
    conflict ? 'schedule-entry-card-conflict' : '',
    !conflict && phase === 'past' ? 'schedule-entry-card-past' : '',
    !conflict && phase === 'active' ? 'schedule-entry-card-active' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

const HOUR_SLOTS = Array.from(
  { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR },
  (_, i) => DAY_TIMELINE_START_HOUR + i,
);

export function ScheduleDayTimeline({
  entries,
  selectedDay,
  now,
  canManage,
  conflictEntryIds,
  onEdit,
}: Props) {
  const gridHeight = dayTimelineGridHeightPx();
  const nowPct = nowLinePercent(now, selectedDay);

  const sorted = [...entries].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.site.name.localeCompare(b.site.name, 'de'),
  );
  const layoutById = layoutDayTimelineColumns(sorted);

  return (
    <div className="schedule-day-timeline">
      <div className="schedule-day-timeline-scroll">
        <div className="schedule-day-timeline-inner">
          <div className="schedule-day-timeline-hours" aria-hidden="true">
            {HOUR_SLOTS.map((hour) => (
              <div
                key={hour}
                className="schedule-day-timeline-hour-label"
                style={{ height: DAY_TIMELINE_PX_PER_HOUR }}
              >
                {formatTimelineHourLabel(hour)}
              </div>
            ))}
          </div>
          <div className="schedule-day-timeline-grid" style={{ height: gridHeight }}>
            {HOUR_SLOTS.map((hour, index) => (
              <div
                key={hour}
                className="schedule-day-timeline-hour-row"
                style={{
                  top: `${(index / HOUR_SLOTS.length) * 100}%`,
                  height: `${100 / HOUR_SLOTS.length}%`,
                }}
              />
            ))}

            {nowPct !== null ? (
              <div
                className="schedule-day-timeline-now"
                style={{ top: `${nowPct}%` }}
                aria-hidden="true"
              />
            ) : null}

            {sorted.length === 0 ? (
              <p className="muted schedule-day-timeline-empty">Keine Einsätze an diesem Tag.</p>
            ) : (
              sorted.map((entry, index) => {
                const layout = layoutById.get(entry.id)!;
                const location = siteLocationLine(entry.site);
                const cardClass = [
                  entryCardClassName(entry, conflictEntryIds.has(entry.id), now),
                  layout.columnCount > 1 ? 'schedule-day-timeline-event--narrow' : '',
                  canManage ? 'schedule-day-timeline-event--clickable' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const style = {
                  top: `${layout.topPercent}%`,
                  height: `${layout.heightPercent}%`,
                  left: `${layout.leftPercent}%`,
                  width: `${layout.widthPercent}%`,
                  zIndex: 10 + index,
                };
                const body = (
                  <>
                    <div className="schedule-day-timeline-event-head">
                      <div className="schedule-day-timeline-event-meta">
                        <span className="schedule-entry-code">{entry.leaderLabel}</span>
                        <span className="schedule-day-timeline-event-time">
                          {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <strong className="schedule-day-timeline-event-site">{entry.site.name}</strong>
                      {location ? (
                        <span className="muted schedule-day-timeline-event-location">{location}</span>
                      ) : null}
                    </div>
                    <p className="schedule-day-timeline-event-team">{memberLine(entry)}</p>
                    {entry.foreman ? (
                      <p className="schedule-day-timeline-event-foreman">
                        Vorarbeiter: {entry.foreman.first_name} {entry.foreman.last_name}
                      </p>
                    ) : null}
                    {entry.equipmentLabel ? (
                      <p className="schedule-day-timeline-event-equipment">{entry.equipmentLabel}</p>
                    ) : null}
                    {entry.notes ? (
                      <p className="muted schedule-day-timeline-event-notes">{entry.notes}</p>
                    ) : null}
                  </>
                );

                if (canManage) {
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={cardClass}
                      style={style}
                      onClick={() => onEdit(entry)}
                      aria-label={`Einsatz ${entry.site.name} bearbeiten`}
                    >
                      {body}
                    </button>
                  );
                }

                return (
                  <article key={entry.id} className={cardClass} style={style}>
                    {body}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
