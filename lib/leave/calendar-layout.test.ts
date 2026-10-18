import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLeaveBarsForUser, type LeaveCalendarRequest } from '@/lib/leave/calendar-layout';
import { daysInMonth } from '@/lib/leave/calendar-month';

describe('layoutLeaveBarsForUser', () => {
  const monthDays = daysInMonth('2026-10');

  it('clippt mehrtägige Anträge auf den Monat', () => {
    const reqs: LeaveCalendarRequest[] = [
      {
        id: '1',
        user_id: 'u1',
        leave_type: 'urlaub',
        start_date: '2026-09-28',
        end_date: '2026-10-03',
        status: 'approved',
      },
    ];
    const layout = layoutLeaveBarsForUser(reqs, monthDays);
    assert.equal(layout.length, 1);
    assert.equal(layout[0]!.colStart, 0);
    assert.equal(layout[0]!.colSpan, 3);
  });

  it('stackt überlappende Anträge in zweite Zeile', () => {
    const reqs: LeaveCalendarRequest[] = [
      {
        id: '1',
        user_id: 'u1',
        leave_type: 'urlaub',
        start_date: '2026-10-05',
        end_date: '2026-10-10',
        status: 'approved',
      },
      {
        id: '2',
        user_id: 'u1',
        leave_type: 'schule',
        start_date: '2026-10-08',
        end_date: '2026-10-12',
        status: 'approved',
      },
    ];
    const layout = layoutLeaveBarsForUser(reqs, monthDays);
    assert.equal(layout.length, 2);
    assert.equal(layout[0]!.row, 0);
    assert.equal(layout[1]!.row, 1);
  });
});
