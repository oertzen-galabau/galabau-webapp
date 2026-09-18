'use client';

import { useState } from 'react';
import { AppSelect } from '@/components/ui/app-select';

export type SiteOption = {
  id: string;
  name: string;
  default_travel_minutes?: number;
};

export type SegmentRow = {
  siteId: string;
  travelMinutes: number;
};

type Props = {
  sites: SiteOption[];
  initialSegments?: SegmentRow[];
  namePrefix?: string;
  onChange?: (rows: SegmentRow[]) => void;
};

export function TimeEntrySegmentsFields({
  sites,
  initialSegments = [],
  namePrefix = 'segment',
  onChange,
}: Props) {
  const [rows, setRows] = useState<SegmentRow[]>(
    initialSegments.length > 0 ? initialSegments : [{ siteId: '', travelMinutes: 0 }],
  );

  function emit(next: SegmentRow[]) {
    setRows(next);
    onChange?.(next);
  }

  function updateRow(index: number, patch: Partial<SegmentRow>) {
    emit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    emit([...rows, { siteId: '', travelMinutes: 0 }]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    emit(rows.filter((_, i) => i !== index));
  }

  function handleSiteChange(index: number, siteId: string) {
    const site = sites.find((s) => s.id === siteId);
    updateRow(index, {
      siteId,
      travelMinutes: site?.default_travel_minutes ?? rows[index]?.travelMinutes ?? 0,
    });
  }

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="time-segments">
      <p className="time-segments-title">
        Baustellen & Wegezeit (Besonderheit ab 30 Min.)
      </p>
      {rows.map((row, index) => (
        <div key={index} className="time-segment-row">
          <div className="time-segment-field">
            <span className="time-segment-field-label">Baustelle</span>
            <AppSelect
              name={`${namePrefix}_site_id[]`}
              value={row.siteId}
              onValueChange={(siteId) => handleSiteChange(index, siteId)}
              options={siteOptions}
              placeholder="—"
            />
          </div>
          <label className="time-segment-field">
            <span className="time-segment-field-label">Wegezeit (Min.)</span>
            <input
              type="number"
              name={`${namePrefix}_travel_minutes[]`}
              min={0}
              inputMode="numeric"
              value={row.travelMinutes}
              onChange={(e) => updateRow(index, { travelMinutes: Number(e.target.value) })}
            />
          </label>
          {rows.length > 1 && (
            <button type="button" className="text-button" onClick={() => removeRow(index)}>
              Entfernen
            </button>
          )}
        </div>
      ))}
      <button type="button" className="text-button" onClick={addRow}>
        + Baustelle
      </button>
    </div>
  );
}
