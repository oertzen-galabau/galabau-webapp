'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
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
  addYears,
  dayOfMonth,
  formatYearHeading,
  isoWeekNumber,
  isWeekendDay,
  monthSpansForYear,
  weekdayShort,
} from '@/lib/leave/calendar-month';
import { LEAVE_TYPE_LABELS } from '@/lib/leave/labels';
import type { TeamLeaveCalendarData } from '@/lib/leave/load-team-calendar-data';
import {
  tenantClosureForDay,
  tenantClosureTitlesForDay,
} from '@/lib/leave/calendar-tenant-closures';
import { useLeaveCalendarLayout } from '@/lib/leave/use-leave-calendar-density';
import { useLeaveCalendarClosureHint } from '@/lib/leave/use-leave-calendar-closure-hint';
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
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledYearRef = useRef<string | null>(null);
  const loadedYearRef = useRef(data.year);
  const calLayout = useLeaveCalendarLayout();
  const {
    density,
    dayColMinPx,
    sidebarWidthPx,
    showWeekNumbers,
    rowBasePx,
    rowLanePx,
    monthHeadPx,
    dayHeadPx,
  } = calLayout;
  const closureHintTouch = density !== 'desktop';
  const { pin: closurePin, onClosureDayTap, clearPin: clearClosurePin } =
    useLeaveCalendarClosureHint({
      enabled: closureHintTouch,
      companyHolidays: data.companyHolidays,
      bridgeDays: data.bridgeDays,
      resetKey: data.year,
    });

  const today = todayIsoInBerlin();
  const currentYear = today.slice(0, 4);
  const byUser = useMemo(() => requestsByUserMap(data.requests), [data.requests]);

  const monthSpans = useMemo(() => monthSpansForYear(data.days), [data.days]);
  const todayMonthKey = today.slice(0, 7);

  const dayClosureClass = useCallback(
    (day: string) => {
      const kind = tenantClosureForDay(day, data.companyHolidays, data.bridgeDays);
      if (kind === 'bridge') return 'is-tenant-bridge';
      if (kind === 'company') return 'is-tenant-company';
      return '';
    },
    [data.bridgeDays, data.companyHolidays],
  );

  const onClosureDayKeyDown = useCallback(
    (day: string, e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClosureDayTap(day);
      }
    },
    [onClosureDayTap],
  );

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
      const layout = layoutLeaveBarsForUser(userReqs, data.days);
      const maxRow = layout.reduce((m, l) => Math.max(m, l.row), -1);
      const height = rowBasePx + Math.max(0, maxRow) * rowLanePx;
      return { emp, layout, height };
    });
  }, [filteredEmployees, byUser, data.days, rowBasePx, rowLanePx]);

  const dayCount = data.days.length;
  const gridMinWidth = dayCount * dayColMinPx;
  const gridColumns = `repeat(${dayCount}, ${dayColMinPx}px)`;
  const sidebarHeadHeight = monthHeadPx + dayHeadPx;

  const prevYear = addYears(data.year, -1);
  const nextYear = addYears(data.year, 1);
  const yearHref = (y: string) => `/app/urlaub?year=${y}`;

  const scrollCalendarToToday = useCallback(() => {
    const el = scrollRef.current;
    if (!el || data.year !== currentYear) return;
    const todayIndex = data.days.indexOf(today);
    if (todayIndex < 0) return;

    const applyScroll = () => {
      const sampleHead = el.querySelector('.leave-calendar-day-head') as HTMLElement | null;
      const colW = sampleHead?.offsetWidth ?? dayColMinPx;
      // Heute direkt an den Anfang der Timeline (neben der Mitarbeiter-Spalte)
      el.scrollLeft = Math.max(0, todayIndex * colW);
      scrolledYearRef.current = data.year;
    };

    applyScroll();
    requestAnimationFrame(applyScroll);
  }, [currentYear, data.days, data.year, dayColMinPx, today]);

  const onHeuteClick = useCallback(() => {
    if (data.year !== currentYear) {
      router.push(`/app/urlaub?year=${currentYear}`);
      return;
    }
    scrollCalendarToToday();
  }, [currentYear, data.year, router, scrollCalendarToToday]);

  useLayoutEffect(() => {
    if (data.year !== currentYear) return;
    if (scrolledYearRef.current === data.year) return;
    scrollCalendarToToday();
  }, [data.year, currentYear, scrollCalendarToToday]);

  useEffect(() => {
    if (loadedYearRef.current === data.year) return;
    loadedYearRef.current = data.year;
    scrolledYearRef.current = null;
    if (data.year !== currentYear) {
      scrollRef.current?.scrollTo({ left: 0 });
    }
  }, [data.year, currentYear]);

  return (
    <div
      className={`leave-calendar-page leave-calendar-page--${density}`}
      style={
        {
          '--leave-cal-sidebar-w': `${sidebarWidthPx}px`,
          '--leave-cal-day-col': `${dayColMinPx}px`,
          '--leave-cal-month-head-h': `${monthHeadPx}px`,
          '--leave-cal-day-head-h': `${dayHeadPx}px`,
          '--leave-cal-sidebar-head-h': `${sidebarHeadHeight}px`,
          '--leave-cal-grid-width': `${gridMinWidth}px`,
        } as CSSProperties
      }
    >
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
          <Link href={yearHref(prevYear)} className="secondary-button schedule-toolbar-icon" aria-label="Vorheriges Jahr">
            ←
          </Link>
          <span className="leave-calendar-year-label">{formatYearHeading(data.year)}</span>
          <Link href={yearHref(nextYear)} className="secondary-button schedule-toolbar-icon" aria-label="Nächstes Jahr">
            →
          </Link>
          <button
            type="button"
            className={`secondary-button schedule-toolbar-heute leave-calendar-heute-btn${data.year === currentYear ? ' is-on-current-year' : ''}`}
            onClick={onHeuteClick}
            aria-label={
              data.year === currentYear
                ? 'Zum heutigen Tag im Kalender scrollen'
                : `Zum Jahr ${currentYear} wechseln`
            }
          >
            Heute
          </button>
          {canRequest && (
            <button type="button" className="primary-button leave-calendar-request-btn" onClick={() => setRequestOpen(true)}>
              <span className="leave-calendar-request-btn-long">Abwesenheit beantragen</span>
              <span className="leave-calendar-request-btn-short">Beantragen</span>
            </button>
          )}
        </div>
      </div>

      <div className="leave-calendar-wrap panel">
        <div className="leave-calendar-scroll" ref={scrollRef}>
          <div className="leave-calendar-inner" style={{ minWidth: sidebarWidthPx + gridMinWidth }}>
            <div className="leave-calendar-sidebar" style={{ flexBasis: sidebarWidthPx }}>
              <div
                className="leave-calendar-sidebar-head leave-calendar-sidebar-head--year"
                style={{ minHeight: sidebarHeadHeight }}
              >
                <span>Mitarbeiter</span>
              </div>
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

            <div
              className="leave-calendar-timeline"
              style={{ width: gridMinWidth, minWidth: gridMinWidth }}
            >
              <div
                className="leave-calendar-month-head-row"
                style={{ gridTemplateColumns: gridColumns }}
              >
                {monthSpans.map((span) => (
                  <div
                    key={span.monthKey}
                    className={[
                      'leave-calendar-month-head',
                      span.monthKey === todayMonthKey && data.year === currentYear ? 'is-today-month' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ gridColumn: `${span.colStart + 1} / span ${span.colSpan}` }}
                  >
                    {span.label}
                  </div>
                ))}
              </div>
              <div
                className="leave-calendar-day-head-row"
                style={{ gridTemplateColumns: gridColumns }}
              >
                {data.days.map((day) => {
                  const isToday = day === today;
                  const isWeekend = isWeekendDay(day);
                  const showKw =
                    showWeekNumbers &&
                    dayColMinPx >= 28 &&
                    (day === data.days[0] || weekdayShort(day).toLowerCase().startsWith('mo'));
                  const closureKind = dayClosureClass(day);
                  const closureTitle = tenantClosureTitlesForDay(
                    day,
                    data.companyHolidays,
                    data.bridgeDays,
                  );
                  const headTappable = closureHintTouch && closureKind;
                  return (
                    <div
                      key={day}
                      className={[
                        'leave-calendar-day-head',
                        isWeekend ? 'is-weekend' : '',
                        isToday ? 'is-today' : '',
                        closureKind,
                        headTappable ? 'is-closure-tappable' : '',
                        closurePin?.day === day ? 'is-closure-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={!closureHintTouch && closureTitle ? closureTitle : undefined}
                      role={headTappable ? 'button' : undefined}
                      tabIndex={headTappable ? 0 : undefined}
                      onClick={headTappable ? () => onClosureDayTap(day) : undefined}
                      onKeyDown={headTappable ? (e) => onClosureDayKeyDown(day, e) : undefined}
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
                    gridTemplateColumns: gridColumns,
                    width: gridMinWidth,
                    minHeight: height,
                  }}
                >
                  {data.days.map((day) => {
                    const closureKind = dayClosureClass(day);
                    const closureTitle = tenantClosureTitlesForDay(
                      day,
                      data.companyHolidays,
                      data.bridgeDays,
                    );
                    const tappable = closureHintTouch && closureKind;
                    return (
                      <div
                        key={day}
                        className={[
                          'leave-calendar-day-cell',
                          isWeekendDay(day) ? 'is-weekend' : '',
                          day === today ? 'is-today' : '',
                          closureKind,
                          tappable ? 'is-closure-tappable' : '',
                          closurePin?.day === day ? 'is-closure-active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        title={!closureHintTouch && closureTitle ? closureTitle : undefined}
                        role={tappable ? 'button' : undefined}
                        tabIndex={tappable ? 0 : undefined}
                        onClick={
                          tappable
                            ? () => onClosureDayTap(day)
                            : undefined
                        }
                        onKeyDown={tappable ? (e) => onClosureDayKeyDown(day, e) : undefined}
                      />
                    );
                  })}
                  {layout.map((item) => {
                    const tone = calendarBarTone(
                      item.request.leave_type,
                      item.request.status,
                      viewer,
                      item.request.user_id,
                    );
                    const title = calendarBarTitle(
                      item.request.leave_type,
                      item.request.start_date,
                      item.request.end_date,
                      item.request.status,
                      viewer,
                      item.request.user_id,
                    );
                    return (
                      <div
                        key={item.request.id}
                        className={`leave-calendar-bar leave-calendar-bar--${tone}`}
                        style={{
                          left: item.colStart * dayColMinPx + 2,
                          width: Math.max(0, item.colSpan * dayColMinPx - 4),
                          top: 6 + item.row * rowLanePx,
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
        {closureHintTouch && closurePin && (
          <div
            className={`leave-calendar-closure-chip leave-calendar-closure-chip--${closurePin.kind}`}
            role="status"
            aria-live="polite"
          >
            <span className="leave-calendar-closure-chip-badge">{closurePin.kindLabel}</span>
            <p className="leave-calendar-closure-chip-text">
              <span className="leave-calendar-closure-chip-date">{closurePin.dateLabel}</span>
              <span className="leave-calendar-closure-chip-sep" aria-hidden>
                ·
              </span>
              <span className="leave-calendar-closure-chip-title">{closurePin.titles}</span>
            </p>
            <button
              type="button"
              className="leave-calendar-closure-chip-close"
              aria-label="Schließen"
              onClick={clearClosurePin}
            >
              ×
            </button>
          </div>
        )}
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
