import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarBarTone,
  calendarLeaveTypeLabel,
} from '@/lib/leave/calendar-display';

const employeeViewer = {
  userId: 'u-self',
  canSeeOthersLeaveReason: false,
};

const managerViewer = {
  userId: 'u-boss',
  canSeeOthersLeaveReason: true,
};

describe('calendar-display', () => {
  it('maskiert fremde Abwesenheitsarten für normale Mitarbeiter', () => {
    assert.equal(
      calendarLeaveTypeLabel('krankheit', employeeViewer, 'u-other'),
      'Abwesend',
    );
    assert.equal(calendarLeaveTypeLabel('urlaub', employeeViewer, 'u-other'), 'Abwesend');
  });

  it('zeigt eigene Abwesenheitsart für Mitarbeiter', () => {
    assert.equal(calendarLeaveTypeLabel('urlaub', employeeViewer, 'u-self'), 'Urlaub');
    assert.equal(calendarLeaveTypeLabel('krankheit', employeeViewer, 'u-self'), 'Krankheit');
  });

  it('zeigt fremde Arten für Berechtigte', () => {
    assert.equal(calendarLeaveTypeLabel('krankheit', managerViewer, 'u-other'), 'Krankheit');
    assert.equal(calendarLeaveTypeLabel('urlaub', managerViewer, 'u-other'), 'Urlaub');
  });

  it('nutzt neutrale Balkenfarbe für maskierte fremde Einträge', () => {
    assert.equal(
      calendarBarTone('urlaub', 'approved', employeeViewer, 'u-other'),
      'sensitive',
    );
    assert.equal(
      calendarBarTone('urlaub', 'approved', employeeViewer, 'u-self'),
      'vacation',
    );
  });
});
