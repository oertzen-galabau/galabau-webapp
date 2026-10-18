import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterScheduleEmployeesForPicker } from '@/lib/schedule/employee-filter';

const workAreas = [
  { id: 'a-bau', name: 'Baustelle', is_active: true, schedule_assignable: true },
  { id: 'a-verw', name: 'Verwaltung', is_active: true, schedule_assignable: false },
];

const employees = [
  { id: 'u1', first_name: 'Anna', last_name: 'Bau', work_area_id: 'a-bau' },
  { id: 'u2', first_name: 'Ben', last_name: 'Verw', work_area_id: 'a-verw' },
  { id: 'u3', first_name: 'Chris', last_name: 'Neu', work_area_id: null },
];

describe('filterScheduleEmployeesForPicker', () => {
  it('blendet nicht einplanbare Bereiche standardmäßig aus', () => {
    const visible = filterScheduleEmployeesForPicker(employees, workAreas, {
      areaKey: 'all',
      areaId: null,
      searchQuery: '',
      showNonAssignable: false,
    });
    assert.deepEqual(visible.map((e) => e.id).sort(), ['u1', 'u3']);
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
});
