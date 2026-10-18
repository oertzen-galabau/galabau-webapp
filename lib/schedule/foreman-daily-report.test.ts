import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  entriesMissingForeman,
  entriesMissingForemanDailyLog,
  formatMissingDailyReportError,
  formatMissingForemanError,
  memberUserIdsIncludingForeman,
  planDateRequiresDailyLog,
} from '@/lib/schedule/foreman-daily-report';

const entry = (
  overrides: Partial<{
    id: string;
    site_id: string;
    start_date: string;
    foreman_user_id: string | null;
    siteName: string;
    foremanName: string;
  }> = {},
) => ({
  id: 'e1',
  site_id: 's1',
  start_date: '2026-10-06',
  foreman_user_id: 'u-va',
  siteName: 'Baustelle A',
  foremanName: 'Max VA',
  ...overrides,
});

describe('entriesMissingForeman', () => {
  it('findet Einsätze ohne Vorarbeiter', () => {
    const missing = entriesMissingForeman([
      entry({ foreman_user_id: 'u1' }),
      entry({ id: 'e2', foreman_user_id: null, siteName: 'B' }),
    ]);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].siteName, 'B');
  });
});

describe('entriesMissingForemanDailyLog', () => {
  it('erkennt fehlenden Log vom Vorarbeiter', () => {
    const missing = entriesMissingForemanDailyLog(
      [entry()],
      [{ site_id: 's1', log_date: '2026-10-06', created_by: 'other' }],
    );
    assert.equal(missing.length, 1);
  });

  it('akzeptiert Log vom Vorarbeiter', () => {
    const missing = entriesMissingForemanDailyLog(
      [entry()],
      [{ site_id: 's1', log_date: '2026-10-06', created_by: 'u-va' }],
    );
    assert.equal(missing.length, 0);
  });
});

describe('planDateRequiresDailyLog', () => {
  it('verlangt Log nur für vergangene Tage', () => {
    assert.equal(planDateRequiresDailyLog('2026-10-05', '2026-10-06'), true);
    assert.equal(planDateRequiresDailyLog('2026-10-06', '2026-10-06'), false);
    assert.equal(planDateRequiresDailyLog('2026-10-07', '2026-10-06'), false);
  });
});

describe('formatMissingForemanError', () => {
  it('listet Baustellen', () => {
    const msg = formatMissingForemanError([entry({ siteName: 'Hof X', foreman_user_id: null })]);
    assert.match(msg, /Hof X/);
  });
});

describe('formatMissingDailyReportError', () => {
  it('listet Baustelle und Vorarbeiter', () => {
    const msg = formatMissingDailyReportError([entry()]);
    assert.match(msg, /Baustelle A/);
    assert.match(msg, /Max VA/);
  });
});

describe('memberUserIdsIncludingForeman', () => {
  it('fügt Vorarbeiter hinzu', () => {
    assert.deepEqual(memberUserIdsIncludingForeman(['u1'], 'u2').sort(), ['u1', 'u2']);
    assert.deepEqual(memberUserIdsIncludingForeman(['u1'], 'u1'), ['u1']);
  });
});
