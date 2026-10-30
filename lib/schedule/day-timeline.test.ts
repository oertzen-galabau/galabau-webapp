import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_TIMELINE_MAX_VISIBLE_COLUMNS,
  DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT,
  DAY_TIMELINE_START_MIN,
  dayTimelineGridWidthPercent,
  entryBlockLayout,
  layoutDayTimelineColumns,
  nowLinePercent,
  timeToMinutes,
} from '@/lib/schedule/day-timeline';

describe('timeToMinutes', () => {
  it('parst HH:MM', () => {
    assert.equal(timeToMinutes('11:30'), 11 * 60 + 30);
    assert.equal(timeToMinutes('11:30:00'), 11 * 60 + 30);
  });
});

describe('entryBlockLayout', () => {
  it('positioniert 11:00–12:00 im sichtbaren Fenster', () => {
    const { topPercent, heightPercent } = entryBlockLayout('11:00', '12:00');
    const total = 14 * 60;
    const expectedTop = ((11 * 60 - DAY_TIMELINE_START_MIN) / total) * 100;
    const expectedHeight = (60 / total) * 100;
    assert.ok(Math.abs(topPercent - expectedTop) < 0.01);
    assert.ok(Math.abs(heightPercent - expectedHeight) < 0.01);
  });

  it('clamp vor 06:00', () => {
    const layout = entryBlockLayout('05:00', '07:00');
    assert.equal(layout.topPercent, 0);
    assert.ok(layout.heightPercent > 0);
  });

  it('clamp nach 20:00', () => {
    const layout = entryBlockLayout('19:00', '21:00');
    assert.ok(layout.topPercent > 90);
    assert.ok(layout.heightPercent >= 2);
  });
});

describe('layoutDayTimelineColumns', () => {
  it('legt zwei überlappende Einsätze nebeneinander', () => {
    const map = layoutDayTimelineColumns([
      { id: 'a', start_time: '07:00', end_time: '16:00' },
      { id: 'b', start_time: '07:00', end_time: '12:00' },
    ]);
    assert.equal(map.get('a')?.columnCount, 2);
    assert.equal(map.get('b')?.columnCount, 2);
    assert.notEqual(map.get('a')?.columnIndex, map.get('b')?.columnIndex);
    assert.ok((map.get('a')?.widthPercent ?? 100) < 50);
  });

  it('volle Breite ohne Überlappung', () => {
    const map = layoutDayTimelineColumns([
      { id: 'a', start_time: '07:00', end_time: '10:00' },
      { id: 'b', start_time: '11:00', end_time: '16:00' },
    ]);
    assert.equal(map.get('a')?.columnCount, 1);
    assert.equal(map.get('b')?.columnCount, 1);
    assert.ok((map.get('a')?.widthPercent ?? 0) > 90);
  });

  it('behält Kartenbreite bei mehr als vier Überlappungen und erweitert das Raster', () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`,
      start_time: '07:30',
      end_time: '16:00',
    }));
    const map = layoutDayTimelineColumns(entries);
    assert.equal(map.get('e0')?.columnCount, 6);
    assert.equal(map.get('e0')?.gridWidthFactor, 6 / DAY_TIMELINE_MAX_VISIBLE_COLUMNS);
    const fourCol = layoutDayTimelineColumns(
      entries.slice(0, DAY_TIMELINE_MAX_VISIBLE_COLUMNS),
    );
    const wideWidth = map.get('e0')?.widthPercent ?? 0;
    const fourWidth = fourCol.get('e0')?.widthPercent ?? 0;
    assert.ok(Math.abs(wideWidth * map.get('e0')!.gridWidthFactor - fourWidth) < 0.05);
    assert.equal(
      dayTimelineGridWidthPercent(map.values()),
      (6 / DAY_TIMELINE_MAX_VISIBLE_COLUMNS) * 100,
    );
  });

  it('nutzt weniger sichtbare Spalten im Compact-Fallback', () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({
      id: `e${i}`,
      start_time: '07:30',
      end_time: '16:00',
    }));
    const map = layoutDayTimelineColumns(entries, {
      maxVisibleColumns: DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT,
    });
    assert.equal(map.get('e0')?.gridWidthFactor, 4 / DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT);
    assert.ok(
      Math.abs(
        dayTimelineGridWidthPercent(map.values()) -
          (4 / DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT) * 100,
      ) < 1e-9,
    );
  });

  it('drei parallele überlappende Einsätze', () => {
    const map = layoutDayTimelineColumns([
      { id: 'a', start_time: '08:00', end_time: '12:00' },
      { id: 'b', start_time: '09:00', end_time: '13:00' },
      { id: 'c', start_time: '10:00', end_time: '14:00' },
    ]);
    assert.equal(map.get('a')?.columnCount, 3);
    assert.equal(map.get('c')?.columnIndex, 2);
  });
});

describe('nowLinePercent', () => {
  it('ist null an anderen Tagen', () => {
    const now = new Date('2026-10-18T14:30:00+02:00');
    assert.equal(nowLinePercent(now, '2026-10-19'), null);
  });

  it('liefert Prozent am heutigen Tag innerhalb 06–20', () => {
    const now = new Date('2026-10-18T14:30:00+02:00');
    const pct = nowLinePercent(now, '2026-10-18');
    assert.ok(pct !== null);
    assert.ok(pct! > 50 && pct! < 70);
  });
});
