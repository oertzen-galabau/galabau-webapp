import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectBadWeatherLeaveDates,
  collectMandatoryLeaveDates,
  computeLeaveBalanceBreakdown,
  countMandatoryLeaveDays,
} from './balance';

describe('leave balance mandatory days', () => {
  it('counts weekdays in company holiday range', () => {
    // 2025-06-09 Mon – 2025-06-13 Fri = 5 days
    const count = countMandatoryLeaveDays(2025, [{ start_date: '2025-06-09', end_date: '2025-06-13' }], []);
    assert.equal(count, 5);
  });

  it('deduplicates bridge day inside company holiday', () => {
    const dates = collectMandatoryLeaveDates(
      2025,
      [{ start_date: '2025-06-09', end_date: '2025-06-11' }],
      [{ date: '2025-06-10' }],
    );
    assert.equal(dates.size, 3);
  });

  it('ignores weekend bridge days', () => {
    const dates = collectMandatoryLeaveDates(2025, [], [{ date: '2025-06-14' }]); // Saturday
    assert.equal(dates.size, 0);
  });

  it('clips holiday ranges to calendar year', () => {
    const count = countMandatoryLeaveDays(
      2025,
      [{ start_date: '2024-12-30', end_date: '2025-01-03' }],
      [],
    );
    // 2025-01-01 Wed, 02 Thu, 03 Fri
    assert.equal(count, 3);
  });
});

describe('leave balance bad weather', () => {
  it('counts confirmed entry in season with enough work time', () => {
    const dates = collectBadWeatherLeaveDates(
      2025,
      [],
      [
        {
          work_date: '2025-01-15',
          bad_weather_claimed: true,
          bad_weather_confirmed: true,
          start_time: '07:00',
          end_time: '15:00',
          breakfast_start: null,
          breakfast_end: null,
          lunch_start: null,
          lunch_end: null,
        },
      ],
    );
    assert.equal(dates.size, 1);
  });

  it('counts tenant-marked day without confirmation', () => {
    const dates = collectBadWeatherLeaveDates(
      2025,
      [{ work_date: '2025-02-10' }],
      [
        {
          work_date: '2025-02-10',
          bad_weather_claimed: false,
          bad_weather_confirmed: null,
          start_time: '07:00',
          end_time: '15:00',
          breakfast_start: null,
          breakfast_end: null,
          lunch_start: null,
          lunch_end: null,
        },
      ],
    );
    assert.equal(dates.size, 1);
  });

  it('skips SW outside KUG season', () => {
    const dates = collectBadWeatherLeaveDates(
      2025,
      [],
      [
        {
          work_date: '2025-07-01',
          bad_weather_claimed: true,
          bad_weather_confirmed: true,
          start_time: '07:00',
          end_time: '15:00',
          breakfast_start: null,
          breakfast_end: null,
          lunch_start: null,
          lunch_end: null,
        },
      ],
    );
    assert.equal(dates.size, 0);
  });
});

describe('computeLeaveBalanceBreakdown', () => {
  it('subtracts mandatory and non-overlapping SW from rest', () => {
    const result = computeLeaveBalanceBreakdown({
      balance: { entitlement_days: 30, carried_over_days: 0, used_days: 5 },
      year: 2025,
      companyHolidays: [{ start_date: '2025-06-09', end_date: '2025-06-09' }],
      bridgeDays: [],
      tenantBadWeatherDays: [],
      timeEntries: [
        {
          work_date: '2025-01-15',
          bad_weather_claimed: true,
          bad_weather_confirmed: true,
          start_time: '07:00',
          end_time: '15:00',
          breakfast_start: null,
          breakfast_end: null,
          lunch_start: null,
          lunch_end: null,
        },
      ],
    });
    assert.equal(result.mandatoryDays, 1);
    assert.equal(result.badWeatherDays, 1);
    assert.equal(result.badWeatherAllowanceDays, 5);
    assert.equal(result.badWeatherDeductionFromVacation, 1);
    assert.equal(result.totalExtraDeduction, 2);
    assert.equal(result.remaining, 30 - 5 - 2);
    assert.equal(result.effectiveCarriedOver, 0);
    assert.equal(result.totalAvailable, 30);
  });

  it('rechnet Resturlaub Vorjahr in Gesamt und Rest ein', () => {
    const result = computeLeaveBalanceBreakdown({
      balance: { entitlement_days: 30, carried_over_days: 5, used_days: 2 },
      year: 2026,
      companyHolidays: [],
      bridgeDays: [],
      tenantBadWeatherDays: [],
      timeEntries: [],
      badWeatherAllowanceDays: 0,
      badWeatherRuleEnabled: false,
    });
    assert.equal(result.totalAvailable, 35);
    assert.equal(result.remaining, 35 - 2 - 0);
  });

  it('does not reserve SW allowance when none booked', () => {
    const result = computeLeaveBalanceBreakdown({
      balance: { entitlement_days: 30, carried_over_days: 0, used_days: 0 },
      year: 2025,
      companyHolidays: [],
      bridgeDays: [],
      tenantBadWeatherDays: [],
      timeEntries: [],
      badWeatherAllowanceDays: 5,
    });
    assert.equal(result.badWeatherDays, 0);
    assert.equal(result.badWeatherDeductionFromVacation, 0);
    assert.equal(result.remaining, 30);
  });

  it('deducts SW from rest above allowance on top of buffer', () => {
    const swEntries = ['2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10', '2025-01-13'].map(
      (work_date) => ({
        work_date,
        bad_weather_claimed: true,
        bad_weather_confirmed: true,
        start_time: '07:00',
        end_time: '15:00',
        breakfast_start: null,
        breakfast_end: null,
        lunch_start: null,
        lunch_end: null,
      }),
    );
    const result = computeLeaveBalanceBreakdown({
      balance: { entitlement_days: 30, carried_over_days: 0, used_days: 0 },
      year: 2025,
      companyHolidays: [],
      bridgeDays: [],
      tenantBadWeatherDays: [],
      timeEntries: swEntries,
      badWeatherAllowanceDays: 5,
    });
    assert.equal(result.badWeatherDays, 6);
    assert.equal(result.badWeatherDeductionFromVacation, 6);
    assert.equal(result.remaining, 30 - 6);
  });

  it('uses stored manual carry without automatic inflation', () => {
    const result = computeLeaveBalanceBreakdown({
      balance: {
        entitlement_days: 30,
        carried_over_days: 0,
        used_days: 0,
        carried_over_source: 'manual',
      },
      year: 2026,
      companyHolidays: [],
      bridgeDays: [],
      tenantBadWeatherDays: [],
      timeEntries: [],
      badWeatherAllowanceDays: 5,
    });
    assert.equal(result.effectiveCarriedOver, 0);
    assert.equal(result.totalAvailable, 30);
    assert.equal(result.remaining, 30);
  });

  it('does not double-count SW on mandatory day', () => {
    const result = computeLeaveBalanceBreakdown({
      balance: { entitlement_days: 30, carried_over_days: 0, used_days: 0 },
      year: 2025,
      companyHolidays: [{ start_date: '2025-01-15', end_date: '2025-01-15' }],
      bridgeDays: [],
      tenantBadWeatherDays: [],
      timeEntries: [
        {
          work_date: '2025-01-15',
          bad_weather_claimed: true,
          bad_weather_confirmed: true,
          start_time: '07:00',
          end_time: '15:00',
          breakfast_start: null,
          breakfast_end: null,
          lunch_start: null,
          lunch_end: null,
        },
      ],
    });
    assert.equal(result.mandatoryDays, 1);
    assert.equal(result.badWeatherDays, 0);
    assert.equal(result.badWeatherDeductionFromVacation, 0);
    assert.equal(result.remaining, 29);
  });
});
