import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isWeekFullyPublished } from '@/lib/schedule/day-publication';

describe('isWeekFullyPublished', () => {
  it('ist true ohne Einsätze (leere Woche)', () => {
    assert.equal(isWeekFullyPublished([], { '2026-03-02': true }), true);
  });

  it('ist true wenn alle Tage mit Einsätzen veröffentlicht sind', () => {
    assert.equal(
      isWeekFullyPublished(['2026-03-02', '2026-03-03'], {
        '2026-03-02': true,
        '2026-03-03': true,
        '2026-03-04': false,
      }),
      true,
    );
  });

  it('ist false wenn ein Tag mit Einsätzen fehlt', () => {
    assert.equal(
      isWeekFullyPublished(['2026-03-02', '2026-03-03'], {
        '2026-03-02': true,
        '2026-03-03': false,
      }),
      false,
    );
  });
});
