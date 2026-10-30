import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_TIME_TRACKING_RULES,
  evaluateBreakCompliance,
  placeExpectedBreakTimes,
} from './break-rules';

const rules = {
  tenant_id: 't',
  ...DEFAULT_TIME_TRACKING_RULES,
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('placeExpectedBreakTimes', () => {
  it('places breakfast and lunch inside a full work day so simple entries do not need reasons', () => {
    const placed = placeExpectedBreakTimes({
      startTime: '07:00',
      endTime: '16:00',
      rules,
    });

    assert.equal(placed.breakfast_start, '08:00');
    assert.equal(placed.breakfast_end, '08:15');
    assert.equal(placed.lunch_start, '11:00');
    assert.equal(placed.lunch_end, '11:30');

    const compliance = evaluateBreakCompliance({
      rules,
      grossWorkMinutes: 9 * 60,
      blocks: [],
      trackedBreakfast: { start: placed.breakfast_start, end: placed.breakfast_end },
      trackedLunch: { start: placed.lunch_start, end: placed.lunch_end },
    });
    assert.equal(compliance.missingBreakfastReasonRequired, false);
    assert.equal(compliance.missingLunchReasonRequired, false);
  });

  it('keeps explicit break times', () => {
    const placed = placeExpectedBreakTimes({
      startTime: '07:00',
      endTime: '16:00',
      rules,
      breakfast: { start: '09:00', end: '09:20' },
      lunch: { start: '12:00', end: '12:45' },
    });
    assert.equal(placed.breakfast_start, '09:00');
    assert.equal(placed.breakfast_end, '09:20');
    assert.equal(placed.lunch_start, '12:00');
    assert.equal(placed.lunch_end, '12:45');
  });

  it('does not place breaks on a short day', () => {
    const placed = placeExpectedBreakTimes({
      startTime: '07:00',
      endTime: '09:00',
      rules,
    });
    assert.equal(placed.breakfast_start, null);
    assert.equal(placed.lunch_start, null);
  });
});
