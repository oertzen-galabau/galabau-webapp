import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthGrid,
  formatMonthLabel,
  shiftViewMonth,
  splitPrimaryAndExtraDates,
} from '@/lib/schedule/entry-plan-dates';

describe('splitPrimaryAndExtraDates', () => {
  it('sortiert und splittet primary/extras', () => {
    const { primary, extras } = splitPrimaryAndExtraDates([
      '2026-10-15',
      '2026-10-12',
      '2026-10-15',
    ]);
    assert.equal(primary, '2026-10-12');
    assert.deepEqual(extras, ['2026-10-15']);
  });

  it('liefert leer ohne Auswahl', () => {
    assert.deepEqual(splitPrimaryAndExtraDates([]), { primary: '', extras: [] });
  });
});

describe('buildMonthGrid', () => {
  it('liefert 42 Zellen mit Mo-Start', () => {
    const grid = buildMonthGrid(2026, 10);
    assert.equal(grid.length, 42);
    const inOctober = grid.filter((c) => c.inCurrentMonth);
    assert.equal(inOctober.length, 31);
    assert.equal(inOctober[0].dayOfMonth, 1);
  });
});

describe('shiftViewMonth', () => {
  it('wechselt über Jahresgrenze', () => {
    assert.deepEqual(shiftViewMonth(2026, 1, -1), { year: 2025, month: 12 });
    assert.deepEqual(shiftViewMonth(2026, 12, 1), { year: 2027, month: 1 });
  });
});

describe('formatMonthLabel', () => {
  it('formatiert auf Deutsch', () => {
    assert.match(formatMonthLabel(2026, 10), /Oktober\s+2026/);
  });
});
