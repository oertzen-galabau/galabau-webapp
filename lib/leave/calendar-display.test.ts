import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calendarLeaveTypeLabel } from '@/lib/leave/calendar-display';

describe('calendar-display', () => {
  it('maskiert sensible Arten für normale Nutzer', () => {
    assert.equal(
      calendarLeaveTypeLabel('krankheit', { canApprove: false }),
      'Abwesend',
    );
    assert.equal(calendarLeaveTypeLabel('urlaub', { canApprove: false }), 'Urlaub');
  });

  it('zeigt sensible Arten für Genehmiger', () => {
    assert.equal(
      calendarLeaveTypeLabel('krankheit', { canApprove: true }),
      'Krankheit',
    );
  });
});
