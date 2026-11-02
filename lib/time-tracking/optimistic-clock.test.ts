import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  optimisticPauseEndIntervals,
  optimisticPauseStartIntervals,
} from '@/lib/time-tracking/optimistic-clock';
import type { TimeEntry, TimeEntryInterval } from '@/lib/types/database';

const entry = {
  id: 'entry-1',
  tenant_id: 'tenant-1',
} as TimeEntry;

const workOpen: TimeEntryInterval = {
  id: 'work-1',
  tenant_id: 'tenant-1',
  time_entry_id: 'entry-1',
  sort_order: 0,
  phase: 'work',
  started_at: '2026-03-30T06:00:00.000Z',
  ended_at: null,
  suggested_block_type: null,
  confirmed_block_type: null,
  created_at: '2026-03-30T06:00:00.000Z',
};

describe('optimistic clock intervals', () => {
  it('closes work and opens pause on pause start', () => {
    const now = new Date('2026-03-30T09:15:00.000Z');
    const next = optimisticPauseStartIntervals(entry, [workOpen], now);
    assert.equal(next.length, 2);
    assert.equal(next[0].ended_at, now.toISOString());
    assert.equal(next[1].phase, 'pause');
    assert.equal(next[1].ended_at, null);
  });

  it('closes pause and opens work on pause end', () => {
    const pauseOpen: TimeEntryInterval = {
      ...workOpen,
      id: 'pause-1',
      phase: 'pause',
      sort_order: 1,
      started_at: '2026-03-30T09:15:00.000Z',
    };
    const closedWork: TimeEntryInterval = {
      ...workOpen,
      ended_at: '2026-03-30T09:15:00.000Z',
    };
    const now = new Date('2026-03-30T09:20:00.000Z');
    const next = optimisticPauseEndIntervals(entry, [closedWork, pauseOpen], now);
    assert.equal(next.length, 3);
    assert.equal(next[1].ended_at, now.toISOString());
    assert.equal(next[2].phase, 'work');
    assert.equal(next[2].ended_at, null);
  });
});
