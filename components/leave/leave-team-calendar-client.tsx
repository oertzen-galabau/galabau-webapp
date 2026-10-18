'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LeaveRequestForm } from '@/components/leave/leave-request-form';
import { AppDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';
import {
  calendarBarTitle,
  calendarBarTone,
  type LeaveCalendarViewer,
} from '@/lib/leave/calendar-display';
import {
  filterEmployeesBySearchAndArea,
  layoutLeaveBarsForUser,
  type LeaveCalendarRequest,
} from '@/lib/leave/calendar-layout';
import {
  addMonths,
  dayOfMonth,
  formatMonthHeading,
  isoWeekNumber,
  isWeekendDay,
  weekdayShort,
} from '@/lib/leave/calendar-month';
import { LEAVE_TYPE_LABELS } from '@/lib/leave/labels';
import type { TeamLeaveCalendarData } from '@/lib/leave/load-team-calendar-data';
import { todayIsoInBerlin } from '@/lib/schedule/week';

type Props = {
  data: TeamLeaveCalendarData;
  canRequest: boolean;
  viewer: LeaveCalendarViewer;
};

const LEAVE_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Alle Abwesenheitsarten' },
  ...Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const ROW_BASE_PX = 52;
const ROW_LANE_PX = 22;

function requestsByUserMap(requests: LeaveCalendarRequest[]): Map<string, LeaveCalendarRequest[]> {
  const map = new Map<string, LeaveCalendarRequest[]>();
  for (const r of requests) {
    const list = map.get(r.user_id) ?? [];
    list.push(r);
    map.set(r.user_id, list);
  }
  return map;
}

export function LeaveTeamCalendarClient({ data, canRequest, viewer }: Props) {
  const [search, setSearch] = useState('');
  const [workAreaId, setWorkAreaId] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);

  const today = todayIsoInBerlin();
  const byUser = useMemo(() => requestsByUserMap(data.requests), [data.requests]);

  const workAreaOptions = useMemo(
    () => [
      { value: '', label: 'Alle Bereiche' },
      ...data.workAreas.filter((a) => a.is_active).map((a) => ({ value: a.id, label: a.name })),
    ],
    [data.workAreas],
  );

  const filteredEmployees = useMemo(
    () =>
      filterEmployeesBySearchAndArea(
        data.employees,
        search,
        workAreaId || null,
        leaveTypeFilter || null,
        byUser,
      ),
    [data.employees, search, workAreaId, leaveTypeFilter, byUser],
  );

  const employeeRows = useMemo(() => {
    return filteredEmployees.map((emp) => {
      const userReqs = byUser.get(emp.id) ?? [];
      const layout = layoutLeaveBarsForUser(userReqs, data.monthDays);
      const maxRow = layout.reduce((m, l) => Math.max(m, l.row), -1);
      const height = ROW_BASE_PX + Math.max(0, maxRow) * ROW_LANE_PX;
      return { emp, layout, height };
    });
  }, [filteredEmployees, byUser, data.monthDays]);

  const dayCount = data.monthDays.length;
  const gridMinWidth = Math.max(dayCount * 36, 480);

  const prevMonth = addMonths(data.month, -1);
  const nextMonth = addMonths(data.month, 1);
  const monthHref = (m: string) => `/app/urlaub?month=${m}`;

  return (
    <div className="leave-calendar-page">
      <div className="leave-calendar-toolbar schedule-toolbar">
        <div className="leave-calendar-toolbar-filters">
          <label className="leave-calendar-search">
            <span className="sr-only">Personen suchen</span>
            <input
              type="search"
              placeholder="Personen suchen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <AppSelect
            value={workAreaId}
            onValueChange={setWorkAreaId}
            options={workAreaOptions}
            aria-label="Mitarbeiter-Bereich"
          />
          <AppSelect
            value={leaveTypeFilter}
            onValueChange={setLeaveTypeFilter}
            options={LEAVE_TYPE_FILTER_OPTIONS}
            aria-label="Abwesenheitsart"
          />
        </div>
        <div className="schedule-toolbar-row schedule-toolbar-nav">
          <Link href={monthHref(prevMonth)} className="secondary-button schedule-toolbar-icon" aria-label="Vorheriger Monat">
            ←
          </Link>
          <span className="leave-calendar-month-label">{formatMonthHeading(data.month)}</span>
          <Link href={monthHref(nextMonth)} className="secondary-button schedule-toolbar-icon" aria-label="Nächster Monat">
            →
          </Link>
          <Link
            href={`/app/urlaub?month=${today.slice(0, 7)}`}
            className={`secondary-button${data.month === today.slice(0, 7) ? ' schedule-toolbar-heute is-current' : ''}`}
          >
            Heute
          </Link>
          {canRequest && (
            <button type="button" className="primary-button" onClick={() => setRequestOpen(true)}>
              Abwesenheit beantragen
            </button>
          )}
        </div>
      </div>

      {(data.companyHolidays.length > 0 || data.bridgeDays.length > 0) && (
        <p className="leave-calendar-tenant-hints muted">
          {data.companyHolidays.map((h) => `${h.title} (${h.start_date} – ${h.end_date})`).join(' · ')}
          {data.companyHolidays.length > 0 && data.bridgeDays.length > 0 ? ' · ' : ''}
          {data.bridgeDays.map((b) => `${b.title} (${b.date})`).join(' · ')}
        </p>
      )}

      <p className="leave-calendar-count muted">
        {filteredEmployees.length} Personen von {data.employees.length} in Ihrem Unternehmen
      </p>

      <div className="leave-calendar-wrap panel">
        <div className="leave-calendar-scroll">
          <div className="leave-calendar-inner" style={{ minWidth: 220 + gridMinWidth }}>
            <div className="leave-calendar-sidebar">
              <div className="leave-calendar-sidebar-head">Mitarbeiter</div>
              {employeeRows.map(({ emp, height }) => (
                <div className="leave-calendar-person-row" key={emp.id} style={{ minHeight: height }}>
                  <span className="person-avatar">
                    {emp.first_name[0]}
                    {emp.last_name[0]}
                  </span>
                  <span className="team-row-person">
                    <strong>
                      {emp.first_name} {emp.last_name}
                    </strong>
                    <small>{emp.job_title?.trim() || '—'}</small>
                  </span>
                </div>
              ))}
              {employeeRows.length === 0 && (
                <p className="muted leave-calendar-empty">Keine passenden Mitarbeiter.</p>
              )}
            </div>

            <div className="leave-calendar-timeline" style={{ minWidth: gridMinWidth }}>
              <div
                className="leave-calendar-day-head-row"
                style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(36px, 1fr))` }}
              >
                {data.monthDays.map((day) => {
                  const isToday = day === today;
                  const isWeekend = isWeekendDay(day);
                  const showKw =
                    day === data.monthDays[0] || weekdayShort(day).toLowerCase().startsWith('mo');
                  return (
                    <div
                      key={day}
                      className={[
                        'leave-calendar-day-head',
                        isWeekend ? 'is-weekend' : '',
                        isToday ? 'is-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {showKw && <span className="leave-calendar-kw">KW{isoWeekNumber(day)}</span>}
                      <span className="leave-calendar-dow">{weekdayShort(day)}</span>
                      <span className="leave-calendar-dom">{dayOfMonth(day)}</span>
                    </div>
                  );
                })}
              </div>

              {employeeRows.map(({ emp, layout, height }) => (
                <div
                  key={emp.id}
                  className="leave-calendar-body-row"
                  style={{
                    gridTemplateColumns: `repeat(${dayCount}, minmax(36px, 1fr))`,
                    minHeight: height,
                  }}
                >
                  {data.monthDays.map((day) => (
                    <div
                      key={day}
                      className={[
                        'leave-calendar-day-cell',
                        isWeekendDay(day) ? 'is-weekend' : '',
                        day === today ? 'is-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                  ))}
                  {layout.map((item) => {
                    const tone = calendarBarTone(item.request.leave_type, item.request.status);
                    const title = calendarBarTitle(
                      item.request.leave_type,
                      item.request.start_date,
                      item.request.end_date,
                      item.request.status,
                      viewer,
                    );
                    return (
                      <div
                        key={item.request.id}
                        className={`leave-calendar-bar leave-calendar-bar--${tone}`}
                        style={{
                          gridColumn: `${item.colStart + 1} / span ${item.colSpan}`,
                          gridRow: 1,
                          marginTop: 8 + item.row * ROW_LANE_PX,
                        }}
                        title={title}
                      >
                        <span className="leave-calendar-bar-label">{title}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {canRequest && (
        <AppDialog
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          title="Abwesenheit beantragen"
          panelClassName="dialog-panel--form"
        >
          <LeaveRequestForm />
        </AppDialog>
      )}
    </div>
  );
}
