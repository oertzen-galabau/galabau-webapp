'use client';

import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import { scheduleEntryPhase } from '@/lib/schedule/entry-phase';
import { sortedEntryTeamDisplay } from '@/lib/schedule/entry-member-labels';
import {
  DAY_TIMELINE_END_HOUR,
  DAY_TIMELINE_PX_PER_HOUR,
  DAY_TIMELINE_START_HOUR,
  dayTimelineGridHeightPx,
  formatTimelineHourLabel,
  dayTimelineGridWidthPercent,
  dayTimelineMaxVisibleColumns,
  layoutDayTimelineColumns,
  nowLinePercent,
} from '@/lib/schedule/day-timeline';
import { sortScheduleEntriesForDisplay } from '@/lib/schedule/entry-sort';
import {
  ScheduleDraggableEntryButton,
  ScheduleEntryDropWrap,
} from '@/components/schedule/schedule-entry-dnd-wrap';
import { useDayTimelineCompactViewport } from '@/lib/schedule/use-day-timeline-compact';

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
  const compactViewport = useDayTimelineCompactViewport();
  const maxVisibleColumns = dayTimelineMaxVisibleColumns(compactViewport);
  const gridHeight = dayTimelineGridHeightPx();
  const nowPct = nowLinePercent(now, selectedDay);

  const sorted = sortScheduleEntriesForDisplay(entries);
  const layoutById = layoutDayTimelineColumns(
    sorted.map((e) => ({
      id: e.id,
      start_time: e.start_time,
      end_time: e.end_time,
      sort_order: e.sort_order,
    })),
    { maxVisibleColumns },
  );
  const gridWidthPercent = dayTimelineGridWidthPercent(layoutById.values());

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
          <div className="schedule-day-timeline-grid-scroll">
            <div
              className={[
                'schedule-day-timeline-grid',
                gridWidthPercent > 100 ? 'schedule-day-timeline-grid--scroll-x' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                height: gridHeight,
                ...(gridWidthPercent > 100 ? { width: `${gridWidthPercent}%` } : {}),
              }}
            >
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
                  layout.columnCount > 1 && layout.columnCount <= maxVisibleColumns
                    ? 'schedule-day-timeline-event--narrow'
                    : '',
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
                const team = sortedEntryTeamDisplay(entry);
                const equipmentNames = entry.equipment
                  .map((eq) => eq.name.trim())
                  .filter(Boolean);
                const hasTeam = team.members.length > 0 || team.external.length > 0;
                const hasEquipment = equipmentNames.length > 0;
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
                    {!hasTeam && !hasEquipment ? (
                      <p className="schedule-day-timeline-event-details">—</p>
                    ) : (
                      <div className="schedule-day-timeline-event-details">
                        {hasTeam ? (
                          <>
                            {team.members.length > 0 ? (
                              <ul className="schedule-day-timeline-event-team-list">
                                {team.members.map((line, lineIndex) => (
                                  <li
                                    key={`${entry.id}-m-${lineIndex}`}
                                    className={
                                      line.isForeman
                                        ? 'schedule-day-timeline-event-team-list-item--foreman'
                                        : undefined
                                    }
                                  >
                                    {line.text}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            {team.external.length > 0 ? (
                              <>
                                {team.members.length > 0 ? (
                                  <div
                                    className="schedule-day-timeline-event-team-sep"
                                    role="separator"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                <ul className="schedule-day-timeline-event-team-list schedule-day-timeline-event-team-list--external">
                                  {team.external.map((line, lineIndex) => (
                                    <li key={`${entry.id}-x-${lineIndex}`}>{line}</li>
                                  ))}
                                </ul>
                              </>
                            ) : null}
                          </>
                        ) : null}
                        {hasEquipment ? (
                          <>
                            {hasTeam ? (
                              <div
                                className="schedule-day-timeline-event-team-sep"
                                role="separator"
                                aria-hidden="true"
                              />
                            ) : null}
                            <ul className="schedule-day-timeline-event-team-list schedule-day-timeline-event-team-list--equipment">
                              {equipmentNames.map((name, lineIndex) => (
                                <li key={`${entry.id}-eq-${lineIndex}`}>{name}</li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </div>
                    )}
                    {entry.notes ? (
                      <p className="muted schedule-day-timeline-event-notes">{entry.notes}</p>
                    ) : null}
                  </>
                );

                if (canManage) {
                  return (
                    <ScheduleEntryDropWrap
                      key={entry.id}
                      entryId={entry.id}
                      planDate={entry.start_date}
                      enabled
                      slotStyle={style}
                      slotClassName="schedule-day-timeline-event-slot"
                    >
                      <ScheduleDraggableEntryButton
                        entryId={entry.id}
                        className={cardClass}
                        onActivate={() => onEdit(entry)}
                        ariaLabel={`Einsatz ${entry.site.name} bearbeiten oder verschieben`}
                      >
                        {body}
                      </ScheduleDraggableEntryButton>
                    </ScheduleEntryDropWrap>
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
    </div>
  );
}
