import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockDurationMinutes,
  getStatutoryBreakWarning,
  segmentsToPayrollTravel,
  validateTimeline,
} from './timeline';
import { evaluateBreakCompliance, DEFAULT_TIME_TRACKING_RULES } from './break-rules';

describe('validateTimeline', () => {
  it('accepts a full day without gaps', () => {
    const result = validateTimeline(
      [
        { block_type: 'site_work', start_time: '09:00', end_time: '11:00', site_id: 'site-a' },
        { block_type: 'travel', start_time: '11:00', end_time: '11:30' },
        { block_type: 'site_work', start_time: '11:30', end_time: '16:00', site_id: 'site-b' },
      ],
      '09:00',
      '16:00',
    );

    assert.equal(result.ok, true);
    assert.equal(result.workMinutes, 7 * 60);
    assert.equal(result.travelMinutes, 30);
  });

  it('rejects overlapping blocks', () => {
    const result = validateTimeline(
      [
        { block_type: 'site_work', start_time: '09:00', end_time: '12:00', site_id: 'site-a' },
        { block_type: 'travel', start_time: '11:30', end_time: '12:00' },
      ],
      '09:00',
      '12:00',
    );

    assert.equal(result.ok, false);
  });
});

describe('break compliance', () => {
  it('requires separate reasons for missing breakfast and lunch', () => {
    const rules = {
      tenant_id: 'tenant',
      ...DEFAULT_TIME_TRACKING_RULES,
      updated_at: new Date().toISOString(),
    };

    const compliance = evaluateBreakCompliance({
      rules,
      grossWorkMinutes: 8 * 60,
      blocks: [
        { block_type: 'site_work', start_time: '07:00', end_time: '12:00', site_id: 'site-a' },
        { block_type: 'lunch', start_time: '12:00', end_time: '12:30' },
        { block_type: 'site_work', start_time: '12:30', end_time: '16:00', site_id: 'site-a' },
      ],
      trackedBreakfast: { start: null, end: null },
      trackedLunch: { start: '12:00', end: '12:30' },
    });

    assert.equal(compliance.missingBreakfastReasonRequired, true);
    assert.equal(compliance.missingLunchReasonRequired, false);
  });
});

describe('payroll travel extraction', () => {
  it('uses travel block durations in timeline mode', () => {
    const travel = segmentsToPayrollTravel([
      { block_type: 'site_work', start_time: '09:00', end_time: '11:00', site_id: 'site-a' },
      { block_type: 'travel', start_time: '11:00', end_time: '11:45' },
    ]);

    assert.deepEqual(travel, [{ travel_minutes: 45 }]);
  });
});

describe('statutory warnings', () => {
  it('warns below 30 minutes after six hours', () => {
    assert.match(getStatutoryBreakWarning(7 * 60, 15) ?? '', /30 Minuten/);
  });

  it('calculates block duration', () => {
    assert.equal(blockDurationMinutes({ start_time: '09:00', end_time: '11:30' }), 150);
  });
});
