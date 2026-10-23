'use client';

import { useMemo, useState } from 'react';
import type { LeaveDay } from '@/lib/schedule/conflicts';
import {
  employeeDisplayName,
  filterScheduleEmployeesForPicker,
  type ScheduleEmployeePick,
  type ScheduleWorkAreaPick,
} from '@/lib/schedule/employee-filter';

type Props = {
  employees: ScheduleEmployeePick[];
  workAreas: ScheduleWorkAreaPick[];
  planDates: string[];
  leaveDays: LeaveDay[];
  initialSelectedIds: string[];
  initialForemanId: string | null;
  disabled?: boolean;
};

export function ScheduleMemberPicker({
  employees,
  workAreas,
  planDates,
  leaveDays,
  initialSelectedIds,
  initialForemanId,
  disabled,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const next = new Set(initialSelectedIds);
    if (initialForemanId) next.add(initialForemanId);
    return next;
  });
  const [foremanId, setForemanId] = useState<string | null>(initialForemanId);

  const visibleEmployees = useMemo(
    () =>
      filterScheduleEmployeesForPicker(employees, workAreas, {
        areaKey: 'all',
        areaId: null,
        searchQuery: '',
        showNonAssignable: false,
        planDates,
        leaveDays,
      }).sort((a, b) =>
        employeeDisplayName(a).localeCompare(employeeDisplayName(b), 'de'),
      ),
    [employees, workAreas, planDates, leaveDays],
  );

  function toggleMember(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!checked && foremanId === id) {
      setForemanId(null);
    }
  }

  function toggleForeman(id: string, checked: boolean) {
    if (checked) {
      setForemanId(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } else if (foremanId === id) {
      setForemanId(null);
    }
  }

  const hiddenSelectedCount = [...selectedIds].filter(
    (id) => !visibleEmployees.some((e) => e.id === id),
  ).length;

  if (employees.length === 0) {
    return <p className="muted">Keine aktiven Mitarbeiter im Team.</p>;
  }

  return (
    <div className="schedule-member-picker">
      {hiddenSelectedCount > 0 ? (
        <p className="muted schedule-member-picker-hint">
          {hiddenSelectedCount} ausgewählte Mitarbeiter sind durch den Filter ausgeblendet, bleiben aber
          zugewiesen.
        </p>
      ) : null}

      <div className="schedule-member-table-wrap">
        <table className="schedule-member-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col" className="schedule-member-table-check">
                Einplanen
              </th>
              <th scope="col" className="schedule-member-table-check">
                Vorarbeiter
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((e) => {
              const name = employeeDisplayName(e);
              return (
                <tr key={e.id}>
                  <td>{name}</td>
                  <td className="schedule-member-table-check">
                    <label className="schedule-member-table-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(e.id)}
                        onChange={(ev) => toggleMember(e.id, ev.target.checked)}
                        disabled={disabled}
                        aria-label={`${name} einplanen`}
                      />
                    </label>
                  </td>
                  <td className="schedule-member-table-check">
                    <label className="schedule-member-table-checkbox">
                      <input
                        type="checkbox"
                        checked={foremanId === e.id}
                        onChange={(ev) => toggleForeman(e.id, ev.target.checked)}
                        disabled={disabled}
                        aria-label={`${name} als Vorarbeiter`}
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleEmployees.length === 0 ? (
          <p className="muted schedule-member-table-empty">
            Keine verfügbaren Mitarbeiter (Berufsbereich oder Abwesenheit).
          </p>
        ) : null}
      </div>

      {[...selectedIds].map((id) => (
        <input key={id} type="hidden" name="member_user_id[]" value={id} />
      ))}
      <input type="hidden" name="foreman_user_id" value={foremanId ?? ''} />
    </div>
  );
}
