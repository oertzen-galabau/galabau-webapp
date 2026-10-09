import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findEquipmentConflicts, findTimeConflicts, expandLeaveRequests } from '@/lib/schedule/conflicts';

describe('findTimeConflicts', () => {
  it('findet Überschneidung am selben Tag', () => {
    const conflicts = findTimeConflicts([
      {
        entryId: 'a',
        userId: 'u1',
        startDate: '2026-10-09',
        endDate: '2026-10-09',
        startTime: '07:00',
        endTime: '12:00',
      },
      {
        entryId: 'b',
        userId: 'u1',
        startDate: '2026-10-09',
        endDate: '2026-10-09',
        startTime: '11:00',
        endTime: '16:00',
      },
    ]);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].date, '2026-10-09');
  });

  it('ignoriert verschiedene Mitarbeiter', () => {
    const conflicts = findTimeConflicts([
      {
        entryId: 'a',
        userId: 'u1',
        startDate: '2026-10-09',
        endDate: '2026-10-09',
        startTime: '07:00',
        endTime: '16:00',
      },
      {
        entryId: 'b',
        userId: 'u2',
        startDate: '2026-10-09',
        endDate: '2026-10-09',
        startTime: '07:00',
        endTime: '16:00',
      },
    ]);
    assert.equal(conflicts.length, 0);
  });
});

describe('findEquipmentConflicts', () => {
  it('findet Doppelbelegung desselben Geräts', () => {
    const conflicts = findEquipmentConflicts([
      {
        entryId: 'a',
        equipmentId: 'eq1',
        startDate: '2026-10-09',
        endDate: '2026-10-09',
        startTime: '07:00',
        endTime: '12:00',
      },
      {
        entryId: 'b',
        equipmentId: 'eq1',
        startDate: '2026-10-09',
        endDate: '2026-10-09',
        startTime: '11:00',
        endTime: '16:00',
      },
    ]);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].kind, 'equipment');
  });
});

describe('expandLeaveRequests', () => {
  it('expandiert genehmigte Anträge', () => {
    const days = expandLeaveRequests([
      {
        user_id: 'u1',
        start_date: '2026-10-09',
        end_date: '2026-10-10',
        leave_type: 'urlaub',
        status: 'approved',
      },
      {
        user_id: 'u2',
        start_date: '2026-10-09',
        end_date: '2026-10-09',
        leave_type: 'krankheit',
        status: 'pending',
      },
    ]);
    assert.equal(days.length, 2);
    assert.equal(days[0].leaveType, 'urlaub');
  });
});
