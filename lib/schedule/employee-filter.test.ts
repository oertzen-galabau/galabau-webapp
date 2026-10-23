import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterScheduleEmployeesForPicker,
  isAbsentOnAnyPlanDate,
  isEmployeeSelectableForSchedule,
} from '@/lib/schedule/employee-filter';

const workAreas = [
  { id: 'a-bau', name: 'Baustelle', is_active: true, schedule_assignable: true },
  { id: 'a-verw', name: 'Verwaltung', is_active: true, schedule_assignable: false },
];

const employees = [
  { id: 'u1', first_name: 'Anna', last_name: 'Bau', work_area_id: 'a-bau' },
  { id: 'u2', first_name: 'Ben', last_name: 'Verw', work_area_id: 'a-verw' },
  { id: 'u3', first_name: 'Chris', last_name: 'Neu', work_area_id: null },
];

const leaveDays = [{ userId: 'u1', date: '2026-10-24', leaveType: 'vacation' }];

describe('filterScheduleEmployeesForPicker', () => {
  it('blendet nicht einplanbare Bereiche und Mitarbeiter ohne Bereich aus', () => {
    const visible = filterScheduleEmployeesForPicker(employees, workAreas, {
      areaKey: 'all',
      areaId: null,
      searchQuery: '',
      showNonAssignable: false,
    });
    assert.deepEqual(visible.map((e) => e.id), ['u1']);
  });

  it('filtert nach Bereich und Suche', () => {
    const visible = filterScheduleEmployeesForPicker(employees, workAreas, {
      areaKey: 'a-bau',
      areaId: 'a-bau',
      searchQuery: 'ann',
      showNonAssignable: true,
    });
    assert.deepEqual(visible.map((e) => e.id), ['u1']);
  });

  it('blendet abwesende Mitarbeiter an mindestens einem Plan-Tag aus', () => {
    const visible = filterScheduleEmployeesForPicker(employees, workAreas, {
      areaKey: 'all',
      areaId: null,
      searchQuery: '',
      showNonAssignable: false,
      planDates: ['2026-10-23', '2026-10-24'],
      leaveDays,
    });
    assert.deepEqual(visible.map((e) => e.id), []);
  });
});

describe('isAbsentOnAnyPlanDate', () => {
  it('ist true wenn Abwesenheit an einem der Tage', () => {
    assert.equal(isAbsentOnAnyPlanDate('u1', ['2026-10-23', '2026-10-24'], leaveDays), true);
    assert.equal(isAbsentOnAnyPlanDate('u1', ['2026-10-23'], leaveDays), false);
  });
});

describe('isEmployeeSelectableForSchedule', () => {
  it('kombiniert Bereich und Abwesenheit', () => {
    assert.equal(
      isEmployeeSelectableForSchedule(employees[0]!, workAreas, ['2026-10-23'], leaveDays),
      true,
    );
    assert.equal(
      isEmployeeSelectableForSchedule(employees[0]!, workAreas, ['2026-10-24'], leaveDays),
      false,
    );
    assert.equal(
      isEmployeeSelectableForSchedule(employees[2]!, workAreas, ['2026-10-23'], leaveDays),
      false,
    );
  });
});
