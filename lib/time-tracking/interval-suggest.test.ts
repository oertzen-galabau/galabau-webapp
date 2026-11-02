import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_TIME_TRACKING_RULES } from './break-rules';
import { suggestPauseBlockType } from './interval-suggest';

const rules = {
  tenant_id: 't',
  ...DEFAULT_TIME_TRACKING_RULES,
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('suggestPauseBlockType', () => {
  it('suggests travel for first pause shortly after day start', () => {
    const result = suggestPauseBlockType({
      workDate: '2026-06-15',
      dayStartIso: '2026-06-15T07:00:00+02:00',
      pauseStartedAt: '2026-06-15T07:05:00+02:00',
      pauseEndedAt: '2026-06-15T07:35:00+02:00',
      pauseIndex: 0,
      rules,
    });
    assert.equal(result.blockType, 'travel');
  });

  it('suggests breakfast in breakfast window with expected duration', () => {
    const result = suggestPauseBlockType({
      workDate: '2026-06-15',
      dayStartIso: '2026-06-15T07:00:00+02:00',
      pauseStartedAt: '2026-06-15T09:00:00+02:00',
      pauseEndedAt: '2026-06-15T09:15:00+02:00',
      pauseIndex: 1,
      rules,
    });
    assert.equal(result.blockType, 'breakfast');
    assert.equal(result.confidence, 'high');
  });

  it('suggests lunch in lunch window', () => {
    const result = suggestPauseBlockType({
      workDate: '2026-06-15',
      dayStartIso: '2026-06-15T07:00:00+02:00',
      pauseStartedAt: '2026-06-15T12:00:00+02:00',
      pauseEndedAt: '2026-06-15T12:30:00+02:00',
      pauseIndex: 2,
      rules,
    });
    assert.equal(result.blockType, 'lunch');
  });
});
