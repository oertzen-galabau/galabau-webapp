import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isEndAfterPlannedEndWithTolerance,
  isStartAfterPlannedEnd,
  isStartBeforePlannedWithTolerance,
} from './planned-day-start';

describe('isStartBeforePlannedWithTolerance', () => {
  it('detects start before plan minus tolerance', () => {
    assert.equal(isStartBeforePlannedWithTolerance('06:50:00', '07:30:00', 5), true);
    assert.equal(isStartBeforePlannedWithTolerance('07:28:00', '07:30:00', 5), false);
    assert.equal(isStartBeforePlannedWithTolerance('07:35:00', '07:30:00', 5), false);
  });
});

describe('isStartAfterPlannedEnd', () => {
  it('detects clock-in after plan end', () => {
    assert.equal(isStartAfterPlannedEnd('16:01:00', '16:00:00'), true);
    assert.equal(isStartAfterPlannedEnd('16:00:00', '16:00:00'), false);
    assert.equal(isStartAfterPlannedEnd('15:59:00', '16:00:00'), false);
  });
});

describe('isEndAfterPlannedEndWithTolerance', () => {
  it('allows clock-out within tolerance after plan end', () => {
    assert.equal(isEndAfterPlannedEndWithTolerance('16:05:00', '16:00:00', 5), false);
    assert.equal(isEndAfterPlannedEndWithTolerance('16:06:00', '16:00:00', 5), true);
    assert.equal(isEndAfterPlannedEndWithTolerance('15:50:00', '16:00:00', 5), false);
  });
});
