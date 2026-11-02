import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adjustLiveDisplaySeconds,
  computeLiveWorkSeconds,
  deriveWorkDayState,
  parseTimeToSeconds,
} from './work-day';
import type { TimeEntryInterval } from '@/lib/types/database';

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

  it('uses intervals when provided', () => {
    const entry = {
      start_time: '08:00:00',
      end_time: null,
      breakfast_start: null,
      breakfast_end: null,
      lunch_start: null,
      lunch_end: null,
    };
    const intervals: TimeEntryInterval[] = [
      {
        id: '1',
        tenant_id: 't',
        time_entry_id: 'e',
        sort_order: 0,
        phase: 'work',
        started_at: '2026-06-15T08:00:00+02:00',
        ended_at: '2026-06-15T08:10:00+02:00',
        suggested_block_type: null,
        confirmed_block_type: null,
        created_at: '',
      },
      {
        id: '2',
        tenant_id: 't',
        time_entry_id: 'e',
        sort_order: 1,
        phase: 'work',
        started_at: '2026-06-15T08:20:00+02:00',
        ended_at: null,
        suggested_block_type: null,
        confirmed_block_type: null,
        created_at: '',
      },
    ];
    const now = new Date('2026-06-15T08:25:00+02:00');
    assert.equal(computeLiveWorkSeconds(entry, now, 'Europe/Berlin', intervals), 10 * 60 + 5 * 60);
  });
});

describe('deriveWorkDayState with intervals', () => {
  const entry = {
    start_time: '08:00:00',
    end_time: null,
    breakfast_start: null,
    breakfast_end: null,
    lunch_start: null,
    lunch_end: null,
  };

  it('returns paused when open pause interval exists', () => {
    const intervals: TimeEntryInterval[] = [
      {
        id: '1',
        tenant_id: 't',
        time_entry_id: 'e',
        sort_order: 0,
        phase: 'pause',
        started_at: '2026-06-15T09:00:00+02:00',
        ended_at: null,
        suggested_block_type: null,
        confirmed_block_type: null,
        created_at: '',
      },
    ];
    assert.equal(deriveWorkDayState(entry, intervals), 'paused');
  });
});

describe('adjustLiveDisplaySeconds', () => {
  it('subtracts baseline for fresh clock-in display', () => {
    assert.equal(adjustLiveDisplaySeconds(3, 3), 0);
    assert.equal(adjustLiveDisplaySeconds(4, 3), 1);
  });
});
