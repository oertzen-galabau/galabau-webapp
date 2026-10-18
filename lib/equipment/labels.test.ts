import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays } from '@/lib/schedule/week';
import { compareUvvDueEntries, uvvUrgency } from '@/lib/equipment/labels';

const today = '2026-03-01';

describe('uvvUrgency', () => {
  it('klassifiziert überfällig', () => {
    assert.equal(uvvUrgency('2026-02-28', today), 'overdue');
  });

  it('klassifiziert innerhalb 4 Wochen inkl. heute', () => {
    assert.equal(uvvUrgency(today, today), 'within_4_weeks');
    assert.equal(uvvUrgency(addDays(today, 28), today), 'within_4_weeks');
  });

  it('klassifiziert 8-Wochen-Fenster', () => {
    assert.equal(uvvUrgency(addDays(today, 29), today), 'within_8_weeks');
    assert.equal(uvvUrgency(addDays(today, 56), today), 'within_8_weeks');
  });

  it('klassifiziert später als neutral', () => {
    assert.equal(uvvUrgency(addDays(today, 57), today), 'later');
  });

  it('liefert null ohne Datum', () => {
    assert.equal(uvvUrgency(null, today), null);
  });
});

describe('compareUvvDueEntries', () => {
  it('sortiert überfällig vor fällig', () => {
    const sorted = [
      { uvvDueDate: '2026-04-01', urgency: 'within_8_weeks' as const },
      { uvvDueDate: '2026-02-01', urgency: 'overdue' as const },
    ].sort(compareUvvDueEntries);
    assert.equal(sorted[0].urgency, 'overdue');
  });

  it('sortiert gleiche Stufe nach Datum', () => {
    const sorted = [
      { uvvDueDate: '2026-03-20', urgency: 'within_4_weeks' as const },
      { uvvDueDate: '2026-03-05', urgency: 'within_4_weeks' as const },
    ].sort(compareUvvDueEntries);
    assert.equal(sorted[0].uvvDueDate, '2026-03-05');
  });
});
