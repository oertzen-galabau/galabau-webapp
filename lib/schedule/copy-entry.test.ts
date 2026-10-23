import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScheduleEntryCopyRow } from '@/lib/schedule/copy-entry';

describe('normalizeScheduleEntryCopyRow', () => {
  it('liest Mitglieder und Geräte aus Supabase-Joins', () => {
    const row = normalizeScheduleEntryCopyRow({
      site_id: 'site-1',
      start_time: '07:30:00',
      end_time: '16:00:00',
      foreman_user_id: 'u-va',
      external_workers_text: 'GS Nord GmbH',
      notes: null,
      sort_order: 3,
      schedule_entry_members: [{ user_id: 'u1' }, { user_id: 'u2' }],
      schedule_entry_equipment: [{ equipment_id: 'eq-1' }, { equipment_id: 'eq-2' }],
    });
    assert.deepEqual(row.schedule_entry_members, [{ user_id: 'u1' }, { user_id: 'u2' }]);
    assert.deepEqual(row.schedule_entry_equipment, [{ equipment_id: 'eq-1' }, { equipment_id: 'eq-2' }]);
  });
});
