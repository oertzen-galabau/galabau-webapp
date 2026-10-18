'use client';

import { useMemo, useState } from 'react';
import { AppSelect } from '@/components/ui/app-select';
import type { TimeBlockType } from '@/lib/types/database';
import {
  BLOCK_TYPE_LABELS,
  blockDurationMinutes,
  fillFirstTimelineGap,
  findTimelineGaps,
  type TimelineBlockInput,
} from '@/lib/time-tracking/timeline';
import { formatMinutes } from '@/lib/utils/time';

export type SiteOption = {
  id: string;
  name: string;
};

type Props = {
  sites: SiteOption[];
  dayStart: string;
  dayEnd: string;
  initialBlocks?: TimelineBlockInput[];
  onChange?: (blocks: TimelineBlockInput[]) => void;
  variant?: 'default' | 'compact';
  defaultSiteId?: string | null;
};

const BLOCK_TYPE_OPTIONS = (Object.keys(BLOCK_TYPE_LABELS) as TimeBlockType[]).map((value) => ({
  value,
  label: BLOCK_TYPE_LABELS[value],
}));

function emptyBlock(defaultSiteId?: string | null): TimelineBlockInput {
  return {
    block_type: 'site_work',
    start_time: '',
    end_time: '',
    site_id: defaultSiteId ?? '',
  };
}

export function TimeEntryTimelineFields({
  sites,
  dayStart,
  dayEnd,
  initialBlocks = [],
  onChange,
  variant = 'default',
  defaultSiteId = null,
}: Props) {
  const [rows, setRows] = useState<TimelineBlockInput[]>(
    initialBlocks.length > 0 ? initialBlocks : [emptyBlock(defaultSiteId)],
  );

  function emit(next: TimelineBlockInput[]) {
    setRows(next);
    onChange?.(next);
  }

  function updateRow(index: number, patch: Partial<TimelineBlockInput>) {
    emit(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const last = rows[rows.length - 1];
    emit([
      ...rows,
      {
        ...emptyBlock(defaultSiteId),
        start_time: last?.end_time ?? '',
      },
    ]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    emit(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  function fillGap() {
    emit(
      fillFirstTimelineGap(rows, dayStart, dayEnd, {
        siteId: defaultSiteId,
        blockType: defaultSiteId ? 'site_work' : 'other_work',
      }),
    );
  }

  const siteOptions = sites.map((site) => ({ value: site.id, label: site.name }));
  const gaps = useMemo(() => findTimelineGaps(rows, dayStart, dayEnd), [rows, dayStart, dayEnd]);

  const summary = useMemo(() => {
    const validRows = rows.filter((row) => row.start_time && row.end_time);
    const workMinutes = validRows
      .filter(
        (row) =>
          row.block_type === 'site_work' ||
          row.block_type === 'travel' ||
          row.block_type === 'other_work',
      )
      .reduce((sum, row) => sum + blockDurationMinutes(row), 0);
    const travelMinutes = validRows
      .filter((row) => row.block_type === 'travel')
      .reduce((sum, row) => sum + blockDurationMinutes(row), 0);
    return { workMinutes, travelMinutes, count: validRows.length };
  }, [rows]);

  const rowClassName =
    variant === 'compact' ? 'time-timeline-row time-timeline-row--compact' : 'time-timeline-row';

  return (
    <div className={`time-timeline${variant === 'compact' ? ' time-timeline--compact' : ''}`}>
      <div className="time-timeline-header">
        <p className="time-segments-title">
          Tagesaufteilung ({dayStart} – {dayEnd})
        </p>
        <p className="muted">
          Arbeitszeit {formatMinutes(summary.workMinutes)} · Wegezeit{' '}
          {formatMinutes(summary.travelMinutes)}
        </p>
      </div>

      {gaps.length > 0 ? (
        <div className="time-timeline-gap-callout" role="status">
          <span>
            Lücke {gaps[0].start_time}–{gaps[0].end_time}
            {gaps.length > 1 ? ` (+${gaps.length - 1} weitere)` : ''}
          </span>
          <button type="button" className="text-button" onClick={fillGap}>
            Lücke füllen
          </button>
        </div>
      ) : null}

      {rows.map((row, index) => (
        <div key={index} className={rowClassName}>
          <div className="time-segment-field">
            <span className="time-segment-field-label">Art</span>
            <AppSelect
              name="block_type[]"
              value={row.block_type}
              onValueChange={(value) =>
                updateRow(index, {
                  block_type: value as TimeBlockType,
                  site_id: value === 'site_work' ? row.site_id ?? defaultSiteId ?? '' : null,
                })
              }
              options={BLOCK_TYPE_OPTIONS}
              allowEmpty={false}
            />
          </div>

          <div className="time-timeline-row-times">
            <label className="time-segment-field">
              <span className="time-segment-field-label">Von</span>
              <input
                type="time"
                name="block_start[]"
                value={row.start_time}
                onChange={(event) => updateRow(index, { start_time: event.target.value })}
                required
              />
            </label>

            <label className="time-segment-field">
              <span className="time-segment-field-label">Bis</span>
              <input
                type="time"
                name="block_end[]"
                value={row.end_time}
                onChange={(event) => updateRow(index, { end_time: event.target.value })}
                required
              />
            </label>
          </div>

          {row.block_type === 'site_work' ? (
            <div className="time-segment-field time-segment-field--site">
              <span className="time-segment-field-label">Baustelle</span>
              <AppSelect
                name="block_site_id[]"
                value={row.site_id ?? ''}
                onValueChange={(siteId) => updateRow(index, { site_id: siteId })}
                options={siteOptions}
                placeholder="Baustelle wählen"
              />
            </div>
          ) : (
            <input type="hidden" name="block_site_id[]" value="" />
          )}

          {rows.length > 1 && (
            <button type="button" className="text-button time-timeline-remove" onClick={() => removeRow(index)}>
              Entfernen
            </button>
          )}
        </div>
      ))}

      <button type="button" className="text-button" onClick={addRow}>
        + Zeitblock
      </button>
    </div>
  );
}
