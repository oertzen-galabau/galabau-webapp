import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultPauseSelections,
  pausesNeedingConfirmation,
} from '@/components/time-tracking/clock-out-interval-confirm';
import type { TimeEntryInterval } from '@/lib/types/database';

function pauseRow(partial: Partial<TimeEntryInterval> & Pick<TimeEntryInterval, 'id'>): TimeEntryInterval {
  return {
    tenant_id: 't1',
    time_entry_id: 'e1',
    sort_order: 0,
    phase: 'pause',
    started_at: '2026-03-30T08:00:00.000Z',
    ended_at: '2026-03-30T08:15:00.000Z',
    suggested_block_type: 'travel',
    confirmed_block_type: null,
    created_at: '2026-03-30T08:00:00.000Z',
    ...partial,
  };
}

describe('clock-out pause selection helpers', () => {
  it('lists only closed unconfirmed pause intervals', () => {
    const rows = [
      pauseRow({ id: 'a' }),
      pauseRow({ id: 'b', confirmed_block_type: 'lunch' }),
      pauseRow({ id: 'c', phase: 'work', ended_at: null }),
    ];
    const pending = pausesNeedingConfirmation(rows);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.id, 'a');
  });

  it('builds default selections from suggestions', () => {
    const rows = [
      pauseRow({ id: 'a', suggested_block_type: 'breakfast' }),
      pauseRow({ id: 'b', suggested_block_type: null }),
    ];
    const map = buildDefaultPauseSelections(rows);
    assert.equal(map.a, 'breakfast');
    assert.equal(map.b, 'travel');
  });
});
