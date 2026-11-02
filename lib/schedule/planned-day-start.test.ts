import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStartBeforePlannedWithTolerance } from './planned-day-start';

describe('isStartBeforePlannedWithTolerance', () => {
  it('detects start before plan minus tolerance', () => {
    assert.equal(isStartBeforePlannedWithTolerance('06:50:00', '07:30:00', 5), true);
    assert.equal(isStartBeforePlannedWithTolerance('07:28:00', '07:30:00', 5), false);
    assert.equal(isStartBeforePlannedWithTolerance('07:35:00', '07:30:00', 5), false);
  });
});
