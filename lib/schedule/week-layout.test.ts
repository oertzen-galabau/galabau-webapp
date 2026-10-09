import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layoutEntriesForVisibleDays, type WeekEntryLayout } from '@/lib/schedule/week-layout';

describe('layoutEntriesForVisibleDays', () => {
  const base: WeekEntryLayout[] = [
    { entry: {} as WeekEntryLayout['entry'], row: 0, colStart: 4, colSpan: 2 },
    { entry: {} as WeekEntryLayout['entry'], row: 1, colStart: 5, colSpan: 1 },
  ];

  it('kürzt mehrtägige Karte auf Freitag', () => {
    const out = layoutEntriesForVisibleDays(base, 5);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.colStart, 4);
    assert.equal(out[0]!.colSpan, 1);
  });

  it('blendet reines Wochenende aus', () => {
    const out = layoutEntriesForVisibleDays(base, 5);
    assert.equal(out.some((l) => l.colStart >= 5), false);
  });
});
