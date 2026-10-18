import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  automaticCarryFromPreviousRemaining,
  computeEffectiveCarriedOver,
  countUrlaubDaysBeforeExpiry,
} from '@/lib/leave/carry-over';

describe('carry-over', () => {
  it('übernimmt nur positive Vorjahres-Reste', () => {
    assert.equal(automaticCarryFromPreviousRemaining(4.5), 4.5);
    assert.equal(automaticCarryFromPreviousRemaining(-2), 0);
  });

  it('zählt Urlaubstage bis Stichtag', () => {
    const days = countUrlaubDaysBeforeExpiry(
      [{ start_date: '2026-03-28', end_date: '2026-04-02' }],
      2026,
      { month: 3, day: 31 },
    );
    assert.equal(days, 2);
  });

  it('lässt Resturlaub vor Stichtag voll wirksam', () => {
    const r = computeEffectiveCarriedOver({
      carriedOver: 5,
      year: 2026,
      expiry: { month: 3, day: 31 },
      urlaubDaysBeforeExpiry: 0,
      mandatoryDaysBeforeExpiry: 0,
      today: '2026-02-01',
    });
    assert.equal(r.effectiveCarriedOver, 5);
    assert.equal(r.beforeExpiry, true);
  });

  it('verfallen ungenutzter Rest nach Stichtag', () => {
    const r = computeEffectiveCarriedOver({
      carriedOver: 5,
      year: 2026,
      expiry: { month: 3, day: 31 },
      urlaubDaysBeforeExpiry: 0,
      mandatoryDaysBeforeExpiry: 0,
      today: '2026-04-01',
    });
    assert.equal(r.effectiveCarriedOver, 0);
    assert.equal(r.forfeitedCarry, 5);
  });

  it('verbraucht Resturlaub vor Verfall teilweise', () => {
    const r = computeEffectiveCarriedOver({
      carriedOver: 5,
      year: 2026,
      expiry: { month: 3, day: 31 },
      urlaubDaysBeforeExpiry: 2,
      mandatoryDaysBeforeExpiry: 0,
      today: '2026-04-01',
    });
    assert.equal(r.forfeitedCarry, 3);
    assert.equal(r.effectiveCarriedOver, 0);
  });
});
