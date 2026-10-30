import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_TIME_TRACKING_RULES } from './break-rules';
import {
  adjustLiveDisplaySeconds,
  computeLiveWorkSeconds,
  parseTimeToSeconds,
  resolveNextPauseSlot,
} from './work-day';

const rules = {
  tenant_id: 't',
  ...DEFAULT_TIME_TRACKING_RULES,
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('parseTimeToSeconds', () => {
  it('parses HH:MM:SS and HH:MM', () => {
    assert.equal(parseTimeToSeconds('07:30:00'), 7 * 3600 + 30 * 60);
    assert.equal(parseTimeToSeconds('07:30'), 7 * 3600 + 30 * 60);
  });

  it('parses fractional seconds', () => {
    assert.equal(parseTimeToSeconds('09:15:03.456789'), 9 * 3600 + 15 * 60 + 3);
  });
});

describe('computeLiveWorkSeconds', () => {
  it('returns 0 when now equals start', () => {
    const entry = {
      start_time: '08:00:00',
      end_time: null,
      breakfast_start: null,
      breakfast_end: null,
      lunch_start: null,
      lunch_end: null,
    };
    const now = new Date('2026-06-15T08:00:00+02:00');
    assert.equal(computeLiveWorkSeconds(entry, now), 0);
  });

  it('counts seconds after start', () => {
    const entry = {
      start_time: '08:00:00',
      end_time: null,
      breakfast_start: null,
      breakfast_end: null,
      lunch_start: null,
      lunch_end: null,
    };
    const now = new Date('2026-06-15T08:00:03+02:00');
    assert.equal(computeLiveWorkSeconds(entry, now), 3);
  });
});

describe('adjustLiveDisplaySeconds', () => {
  it('subtracts baseline for fresh clock-in display', () => {
    assert.equal(adjustLiveDisplaySeconds(3, 3), 0);
    assert.equal(adjustLiveDisplaySeconds(4, 3), 1);
  });
});

describe('resolveNextPauseSlot', () => {
  const openEntry = {
    start_time: '07:00:00',
    end_time: null,
    breakfast_start: null,
    breakfast_end: null,
    lunch_start: null,
    lunch_end: null,
  };

  it('prefers lunch outside breakfast window (afternoon generic pause)', () => {
    const now = new Date('2026-06-15T14:30:00+02:00');
    assert.equal(resolveNextPauseSlot(openEntry, now, rules), 'lunch');
  });

  it('uses breakfast inside breakfast window', () => {
    const now = new Date('2026-06-15T09:00:00+02:00');
    assert.equal(resolveNextPauseSlot(openEntry, now, rules), 'breakfast');
  });

  it('returns null when both slots are used', () => {
    const now = new Date('2026-06-15T14:30:00+02:00');
    const entry = {
      ...openEntry,
      breakfast_start: '08:00:00',
      breakfast_end: '08:15:00',
      lunch_start: '12:00:00',
      lunch_end: null,
    };
    assert.equal(resolveNextPauseSlot(entry, now, rules), null);
  });
});
