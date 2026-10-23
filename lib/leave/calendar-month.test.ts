import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  addYears,
  daysInMonth,
  daysInYear,
  monthLastDay,
  monthSpansForYear,
  normalizeMonthParam,
  normalizeYearParam,
} from '@/lib/leave/calendar-month';

describe('calendar-month', () => {
  it('normalisiert ungültigen Monat auf aktuellen YYYY-MM', () => {
    const m = normalizeMonthParam('invalid');
    assert.match(m, /^\d{4}-\d{2}$/);
  });

  it('liefert 31 Tage für Oktober 2026', () => {
    const days = daysInMonth('2026-10');
    assert.equal(days.length, 31);
    assert.equal(days[0], '2026-10-01');
    assert.equal(days[30], '2026-10-31');
  });

  it('monthLastDay für Februar Schaltjahr', () => {
    assert.equal(monthLastDay('2028-02'), '2028-02-29');
  });

  it('addMonths über Jahreswechsel', () => {
    assert.equal(addMonths('2026-11', 1), '2026-12');
    assert.equal(addMonths('2026-12', 1), '2027-01');
  });

  it('normalizeYearParam aus month-Fallback', () => {
    assert.equal(normalizeYearParam(undefined, '2026-03'), '2026');
    assert.equal(normalizeYearParam('2025', undefined), '2025');
  });

  it('daysInYear Schaltjahr und Normaljahr', () => {
    assert.equal(daysInYear('2028').length, 366);
    assert.equal(daysInYear('2026').length, 365);
    assert.equal(daysInYear('2026')[0], '2026-01-01');
    assert.equal(daysInYear('2026').at(-1), '2026-12-31');
  });

  it('addYears', () => {
    assert.equal(addYears('2026', 1), '2027');
    assert.equal(addYears('2026', -1), '2025');
  });

  it('monthSpansForYear gruppiert Monate', () => {
    const days = daysInYear('2026');
    const spans = monthSpansForYear(days);
    assert.equal(spans.length, 12);
    assert.equal(spans[0]!.colStart, 0);
    assert.equal(spans[0]!.colSpan, 31);
    assert.equal(spans[1]!.colSpan, 28);
  });
});
