'use client';

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ScheduleEntryDialog } from '@/components/schedule/schedule-entry-dialog';
import { PromptDialog } from '@/components/ui/app-dialogs';
import {
  copyScheduleWeek,
  moveScheduleEntry,
  publishScheduleWeek,
} from '@/lib/actions/schedule';
import { entrySpansDay } from '@/lib/schedule/conflicts';
import { scheduleEntryPhase } from '@/lib/schedule/entry-phase';
import { layoutEntriesForVisibleDays, layoutWeekEntries } from '@/lib/schedule/week-layout';
import { formatDayIndexRanges, siteDayIndicesInWeek } from '@/lib/schedule/site-planning-days';
import type { SchedulePlanData } from '@/lib/schedule/load-plan-data';
import {
  addDays,
  formatGermanDate,
  mondayOfWeek,
  parseIsoDate,
  SCHEDULE_DEFAULT_VISIBLE_DAYS,
  SCHEDULE_WEEKEND_START_INDEX,
  todayIsoInBerlin,
  weekDayLabels,
  dateInRange,
} from '@/lib/schedule/week';
import type { Profile, Site } from '@/lib/types/database';

type Props = {
  plan: SchedulePlanData;
  canManage: boolean;
  canPublish: boolean;
  canShare: boolean;
  currentUserId: string;
  selectedDay: string;
  view: 'week' | 'day';
};

type DragPayload =
  | { kind: 'site'; siteId: string }
  | { kind: 'entry'; entryId: string };

type DropZoneData = { scheduleDay?: string };

function dragPayloadFromActive(active: DragEndEvent['active']): DragPayload | null {
  const fromData = active.data.current as DragPayload | undefined;
  if (fromData?.kind === 'site' && fromData.siteId) return fromData;
  if (fromData?.kind === 'entry' && fromData.entryId) return fromData;

  const rawId = String(active.id);
  if (rawId.startsWith('site-')) return { kind: 'site', siteId: rawId.slice('site-'.length) };
  if (rawId.startsWith('entry-')) return { kind: 'entry', entryId: rawId.slice('entry-'.length) };
  return null;
}

const scheduleCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) return hits;
  return rectIntersection(args);
};

/** Tag unter dem Mauszeiger – unabhängig von dnd-kit-Kollisionen. */
function dayFromPointer(event: DragEndEvent, weekDays: string[]): string | null {
  if (typeof document === 'undefined') return null;
  const origin = event.activatorEvent as Partial<MouseEvent> | null;
  if (typeof origin?.clientX !== 'number' || typeof origin.clientY !== 'number') return null;
  const x = origin.clientX + event.delta.x;
  const y = origin.clientY + event.delta.y;
  for (const el of document.elementsFromPoint(x, y)) {
    const day = (el as HTMLElement).dataset?.scheduleDay;
    if (day && weekDays.includes(day)) return day;
  }
  return null;
}

function resolveDropDay(
  event: DragEndEvent,
  entries: SchedulePlanData['entries'],
  weekDays: string[],
): string | null {
  const fromPointer = dayFromPointer(event, weekDays);
  if (fromPointer) return fromPointer;

  const tryId = (rawId: string): string | null => {
    if (rawId.startsWith('day-head-')) return rawId.slice('day-head-'.length);
    if (rawId.startsWith('day-')) return rawId.slice('day-'.length);
    if (rawId.startsWith('entry-drop-')) {
      const entry = entries.find((e) => e.id === rawId.slice('entry-drop-'.length));
      return entry?.start_date ?? null;
    }
    if (rawId.startsWith('entry-')) {
      const entry = entries.find((e) => e.id === rawId.slice('entry-'.length));
      return entry?.start_date ?? null;
    }
    return null;
  };

  const tryCollision = (rawId: string, data?: DropZoneData): string | null => {
    if (data?.scheduleDay && weekDays.includes(data.scheduleDay)) return data.scheduleDay;
    return tryId(rawId);
  };

  const collisions = event.collisions ?? [];
  for (const hit of collisions) {
    const rawId = String(hit.id);
    if (!rawId.startsWith('day-head-') && !rawId.startsWith('day-')) continue;
    const data = hit.data?.droppableContainer?.data?.current as DropZoneData | undefined;
    const day = tryCollision(rawId, data);
    if (day) return day;
  }

  if (event.over) {
    const data = event.over.data.current as DropZoneData | undefined;
    const fromOver = tryCollision(String(event.over.id), data);
    if (fromOver) return fromOver;
  }

  for (const hit of collisions) {
    const data = hit.data?.droppableContainer?.data?.current as DropZoneData | undefined;
    const fromHit = tryCollision(String(hit.id), data);
    if (fromHit) return fromHit;
  }

  return null;
}

function DroppableDay({
  id,
  data,
  children,
  className,
  style,
  markDay,
}: {
  id: string;
  data?: DropZoneData;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Markiert echte Tages-Spalten für die Zeiger-Erkennung. */
  markDay?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id, data });
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-schedule-day={markDay ? data?.scheduleDay : undefined}
      className={`${className ?? ''} ${isOver ? 'schedule-drop-target' : ''}`.trim()}
    >
      {children}
    </div>
  );
}

function DraggableChip({
  id,
  data,
  children,
  className,
  disabled,
  onClick,
}: {
  id: string;
  data: DragPayload;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled });

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`${className ?? ''} ${isDragging ? 'opacity-50' : ''}`.trim()}
      suppressHydrationWarning
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ScheduleDndRoot({ children }: { children: React.ReactNode }) {
  const { active } = useDndContext();
  return <div className={`schedule-dnd-root${active ? ' is-dragging' : ''}`}>{children}</div>;
}

function entryCardClassName(entry: SchedulePlanData['entries'][number], conflict: boolean, now: Date): string {
  const phase = scheduleEntryPhase(entry, now);
  return [
    'schedule-entry-card',
    conflict ? 'schedule-entry-card-conflict' : '',
    !conflict && phase === 'past' ? 'schedule-entry-card-past' : '',
    !conflict && phase === 'active' ? 'schedule-entry-card-active' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function EntryCard({
  entry,
  conflict,
  onEdit,
  draggable,
  now,
}: {
  entry: SchedulePlanData['entries'][number];
  conflict: boolean;
  onEdit: () => void;
  draggable?: boolean;
  now: Date;
}) {
  const cardClass = entryCardClassName(entry, conflict, now);
  const body = (
    <>
      <span className="schedule-entry-code">{entry.leaderLabel}</span>
      <strong>{entry.site.name}</strong>
      <small>{entry.start_time}–{entry.end_time}</small>
      <small>
        {entry.members.map((m) => `${m.first_name} ${m.last_name.charAt(0)}.`).join(', ') || '—'}
        {entry.external_workers_text ? ` · ${entry.external_workers_text}` : ''}
      </small>
      {entry.equipmentLabel ? <small className="schedule-entry-equipment">{entry.equipmentLabel}</small> : null}
    </>
  );

  if (draggable) {
    return (
      <DraggableChip
        id={`entry-${entry.id}`}
        data={{ kind: 'entry', entryId: entry.id }}
        className={cardClass}
        onClick={() => onEdit()}
      >
        {body}
      </DraggableChip>
    );
  }

  return (
    <button
      type="button"
      className={cardClass}
      onClick={onEdit}
    >
      {body}
    </button>
  );
}

export function SchedulePlanningClient({
  plan,
  canManage,
  canPublish,
  canShare,
  currentUserId,
  selectedDay,
  view,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogEntry, setDialogEntry] = useState<SchedulePlanData['entries'][number] | null>(null);
  const [dialogDefaults, setDialogDefaults] = useState<{ siteId?: string; day?: string }>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [weekendExpanded, setWeekendExpanded] = useState(false);
  const [sitesCollapsed, setSitesCollapsed] = useState(false);

  // Auf dem Handy ohne explizite Ansicht standardmäßig die Tagesansicht öffnen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('view')) return;
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    router.replace(`/app/einsatzplanung?week=${plan.weekStart}&view=day&day=${selectedDay}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sensors = useSensors(
    // Maus: sofort nach 5px. Touch: erst nach kurzem Gedrückthalten, damit Scrollen weiter funktioniert.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const sites = plan.sites as Pick<Site, 'id' | 'name'>[];
  const employees = plan.employees as Pick<Profile, 'id' | 'first_name' | 'last_name'>[];

  const visibleDayCount = weekendExpanded ? plan.weekDays.length : SCHEDULE_DEFAULT_VISIBLE_DAYS;

  const {
    conflictEntryIds,
    weekLayout,
    weekendHasEntries,
    unplannedSites,
    plannedSites,
  } = useMemo(() => {
    const conflictIds = new Set<string>();
    for (const c of plan.scheduleConflicts) {
      conflictIds.add(c.entryIds[0]);
      conflictIds.add(c.entryIds[1]);
    }

    const layoutFull = layoutWeekEntries(plan.entries, plan.weekDays);
    const layoutVisible = layoutEntriesForVisibleDays(layoutFull, visibleDayCount);

    const weekendEntries = plan.entries.some((entry) =>
      plan.weekDays
        .slice(SCHEDULE_WEEKEND_START_INDEX)
        .some((day) => dateInRange(day, entry.start_date, entry.end_date)),
    );

    const dayLabels = weekDayLabels();
    const siteIndices = siteDayIndicesInWeek(plan.entries, plan.weekDays);
    const unplanned: Pick<Site, 'id' | 'name'>[] = [];
    const planned: { site: Pick<Site, 'id' | 'name'>; dayLabel: string }[] = [];
    for (const site of sites) {
      const indices = siteIndices.get(site.id);
      if (indices?.size) {
        planned.push({
          site,
          dayLabel: formatDayIndexRanges([...indices], dayLabels),
        });
      } else {
        unplanned.push(site);
      }
    }
    planned.sort((a, b) => a.site.name.localeCompare(b.site.name, 'de'));
    unplanned.sort((a, b) => a.name.localeCompare(b.name, 'de'));

    return {
      conflictEntryIds: conflictIds,
      weekLayout: layoutVisible,
      weekendHasEntries: weekendEntries,
      unplannedSites: unplanned,
      plannedSites: planned,
    };
  }, [plan.scheduleConflicts, plan.entries, plan.weekDays, sites, visibleDayCount]);

  const visibleWeekDays = plan.weekDays.slice(0, visibleDayCount);
  const maxRow = weekLayout.reduce((m, l) => Math.max(m, l.row), 0);
  const rowCount = maxRow + 1;

  const dayEntries = plan.entries.filter((e) => entrySpansDay(e, selectedDay));

  const dayLabels = weekDayLabels();
  const today = todayIsoInBerlin();
  const weekOfToday = mondayOfWeek(today);
  const heuteHref =
    view === 'day'
      ? `/app/einsatzplanung?week=${weekOfToday}&view=day&day=${today}`
      : `/app/einsatzplanung?week=${weekOfToday}&view=week`;
  const heuteIsCurrent =
    view === 'day'
      ? plan.weekStart === weekOfToday && selectedDay === today
      : plan.weekStart === weekOfToday;

  function renderSiteChip(
    site: Pick<Site, 'id' | 'name'>,
    opts?: { planned?: boolean; dayLabel?: string },
  ) {
    return (
      <DraggableChip
        key={site.id}
        id={`site-${site.id}`}
        data={{ kind: 'site', siteId: site.id }}
        className={`schedule-chip${opts?.planned ? ' schedule-chip-planned' : ''}`}
      >
        <span className="schedule-chip-name">{site.name}</span>
        {opts?.dayLabel ? <span className="schedule-chip-days">{opts.dayLabel}</span> : null}
      </DraggableChip>
    );
  }

  function openCreate(siteId?: string, day?: string) {
    setDialogEntry(null);
    setDialogDefaults({ siteId, day });
    setDialogOpen(true);
  }

  function openEdit(entry: SchedulePlanData['entries'][number]) {
    if (!canManage) return;
    setDialogEntry(entry);
    setDialogDefaults({});
    setDialogOpen(true);
  }

  function navigateWeek(offset: number) {
    const d = new Date(`${plan.weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset * 7);
    const iso = d.toISOString().slice(0, 10);
    const dayParam = view === 'day' ? `&day=${addDays(selectedDay, offset * 7)}` : '';
    router.push(`/app/einsatzplanung?week=${iso}&view=${view}${dayParam}`);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    if (!canManage) return;

    const payload = dragPayloadFromActive(event.active);
    if (!payload) {
      setActionError('Ziehen fehlgeschlagen – bitte Seite neu laden.');
      return;
    }

    const targetDay = resolveDropDay(event, plan.entries, plan.weekDays);
    if (!targetDay) {
      setActionError('Bitte auf einen Wochentag ablegen.');
      return;
    }

    if (payload.kind === 'site') {
      const alreadyPlanned = plan.entries.some(
        (e) => e.site_id === payload.siteId && entrySpansDay(e, targetDay),
      );
      if (alreadyPlanned) {
        setActionError('Diese Baustelle ist an diesem Tag bereits eingeplant. Bitte die vorhandene Karte bearbeiten oder verschieben.');
        return;
      }
      setActionError(null);
      openCreate(payload.siteId, targetDay);
      return;
    }

    startTransition(async () => {
      setActionError(null);
      try {
        const fd = new FormData();
        if (payload.kind === 'entry') {
          const entry = plan.entries.find((e) => e.id === payload.entryId);
          if (!entry) return;
          const span = Math.round(
            (parseIsoDate(entry.end_date).getTime() - parseIsoDate(entry.start_date).getTime()) / 86400000,
          );
          const newEnd = addDays(targetDay, span);
          if (entry.start_date === targetDay && entry.end_date === newEnd) return;
          fd.set('entry_id', payload.entryId);
          fd.set('target_day', targetDay);
          await moveScheduleEntry(fd);
          openEdit({ ...entry, start_date: targetDay, end_date: newEnd });
        }
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen');
      }
    });
  }

  async function sendEmail(to: string) {
    setEmailPending(true);
    try {
      const res = await fetch('/api/schedule/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: view === 'week' ? 'week' : 'day',
          date: selectedDay,
          week_start: plan.weekStart,
          to,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Versand fehlgeschlagen');
      setEmailDialogOpen(false);
    } finally {
      setEmailPending(false);
    }
  }

  async function sharePdf(mode: 'day' | 'week') {
    const url = mode === 'week'
      ? `/api/schedule/pdf?mode=week&week_start=${plan.weekStart}`
      : `/api/schedule/pdf?mode=day&date=${selectedDay}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const file = new File([blob], mode === 'week' ? `wochenplan-${plan.weekStart}.pdf` : `einsatzplan-${selectedDay}.pdf`, {
      type: 'application/pdf',
    });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: mode === 'week' ? 'Wochenplan' : 'Einsatztafel',
      });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
    if (mode === 'day') {
      const text = encodeURIComponent(`Einsatztafel ${selectedDay}`);
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="schedule-page">
      <header className="page-header schedule-header">
        <div>
          <h1>Einsatzplanung</h1>
          <p className="muted">
            {plan.published ? 'Veröffentlicht' : 'Entwurf'}
            {plan.publishedAt ? ` · ${formatGermanDate(plan.weekStart, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
          </p>
        </div>
        <div className="schedule-toolbar">
          <div className="schedule-toolbar-view" role="group" aria-label="Ansicht">
            <Link
              href={`/app/einsatzplanung?week=${plan.weekStart}&view=week`}
              className={view === 'week' ? 'primary-button primary-button--compact' : 'secondary-button secondary-button--compact'}
            >
              Woche
            </Link>
            <Link
              href={`/app/einsatzplanung?week=${plan.weekStart}&view=day&day=${selectedDay}`}
              className={view === 'day' ? 'primary-button primary-button--compact' : 'secondary-button secondary-button--compact'}
            >
              Tag
            </Link>
            <Link
              href={heuteHref}
              className={
                heuteIsCurrent
                  ? 'secondary-button secondary-button--compact schedule-toolbar-heute is-current'
                  : 'secondary-button secondary-button--compact schedule-toolbar-heute'
              }
              aria-current={heuteIsCurrent ? 'true' : undefined}
            >
              Heute
            </Link>
          </div>
          <div className="schedule-toolbar-nav" role="group" aria-label="Woche wechseln">
            <button type="button" className="secondary-button secondary-button--compact schedule-toolbar-icon" onClick={() => navigateWeek(-1)} aria-label="Vorherige Woche">
              ←
            </button>
            <button type="button" className="secondary-button secondary-button--compact schedule-toolbar-icon" onClick={() => navigateWeek(1)} aria-label="Nächste Woche">
              →
            </button>
          </div>
          {canManage ? (
            <>
              <button type="button" className="secondary-button secondary-button--compact" disabled={pending} onClick={() => openCreate()}>
                + Einsatz
              </button>
              <button
                type="button"
                className="secondary-button secondary-button--compact"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const fd = new FormData();
                  fd.set('week_start', plan.weekStart);
                  await copyScheduleWeek(fd);
                  router.refresh();
                })}
              >
                Vorwoche kopieren
              </button>
            </>
          ) : null}
          {canPublish ? (
            <button
              type="button"
              className="primary-button primary-button--compact"
              disabled={pending || plan.published}
              onClick={() => startTransition(async () => {
                const fd = new FormData();
                fd.set('week_start', plan.weekStart);
                await publishScheduleWeek(fd);
                router.refresh();
              })}
            >
              Veröffentlichen
            </button>
          ) : null}
          {canShare ? (
            <>
              <button type="button" className="secondary-button secondary-button--compact" onClick={() => sharePdf(view === 'week' ? 'week' : 'day')}>
                Teilen / PDF
              </button>
              <button type="button" className="secondary-button secondary-button--compact" onClick={() => setEmailDialogOpen(true)}>
                E-Mail
              </button>
            </>
          ) : null}
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={scheduleCollision}
        onDragStart={(e) => {
          setActiveDrag(dragPayloadFromActive(e.active));
          setActionError(null);
        }}
        onDragCancel={() => {
          setActiveDrag(null);
        }}
        onDragEnd={handleDragEnd}
      >
        <ScheduleDndRoot>
        {view === 'week' && canManage ? (
          <div className={`schedule-sites-bar${sitesCollapsed ? ' is-collapsed' : ''}`}>
            <button
              type="button"
              className="schedule-sites-bar-label"
              aria-expanded={!sitesCollapsed}
              onClick={() => setSitesCollapsed((v) => !v)}
            >
              Baustellen
              <span className="schedule-sites-bar-chevron" aria-hidden="true">{sitesCollapsed ? '▸' : '▾'}</span>
            </button>
            <div className="schedule-sites-bar-groups">
              {unplannedSites.length > 0 ? (
                <section className="schedule-sites-bar-group">
                  <h3 className="schedule-sidebar-group-title">
                    Noch nicht eingeplant
                    <span className="schedule-sidebar-group-count">{unplannedSites.length}</span>
                  </h3>
                  <div className="schedule-chip-list">{unplannedSites.map((s) => renderSiteChip(s))}</div>
                </section>
              ) : null}
              {plannedSites.length > 0 ? (
                <section className="schedule-sites-bar-group">
                  <h3 className="schedule-sidebar-group-title">
                    Diese Woche eingeplant
                    <span className="schedule-sidebar-group-count">{plannedSites.length}</span>
                  </h3>
                  <div className="schedule-chip-list">
                    {plannedSites.map(({ site, dayLabel }) => renderSiteChip(site, { planned: true, dayLabel }))}
                  </div>
                </section>
              ) : null}
              {unplannedSites.length === 0 && plannedSites.length === 0 ? (
                <p className="muted schedule-sites-bar-empty">Keine aktiven Baustellen.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {actionError ? <p className="form-error">{actionError}</p> : null}

        {!canManage && !plan.published ? (
          <p className="muted">Diese Woche wurde noch nicht veröffentlicht.</p>
        ) : null}

        {view === 'week' ? (
          <div className="schedule-board">
            <div className={`schedule-week-wrap${weekendExpanded ? ' is-weekend-expanded' : ''}`}>
            <div className={`schedule-week-grid${weekendExpanded ? ' is-weekend-expanded' : ''}`}>
              {visibleWeekDays.map((day) => {
                const labelIdx = plan.weekDays.indexOf(day);
                const isToday = day === today;
                return (
                <DroppableDay
                  key={`head-${day}`}
                  id={`day-head-${day}`}
                  data={{ scheduleDay: day }}
                  markDay
                  className={`schedule-week-col-head schedule-week-col-head-drop${isToday ? ' schedule-week-col-head-today' : ''}`}
                >
                  <span>{weekDayLabels()[labelIdx] ?? '?'}</span>
                  <small>{formatGermanDate(day, { day: '2-digit', month: '2-digit' })}</small>
                </DroppableDay>
              );
              })}
              <div
                className="schedule-week-body"
                style={{ gridTemplateRows: `repeat(${Math.max(rowCount, 1)}, minmax(72px, auto))` }}
              >
                {visibleWeekDays.map((day, colIdx) => (
                  <DroppableDay
                    key={`drop-${day}`}
                    id={`day-${day}`}
                    data={{ scheduleDay: day }}
                    markDay
                    className="schedule-week-col-bg"
                    style={{
                      gridColumn: colIdx + 1,
                      gridRow: `1 / ${Math.max(rowCount, 1) + 1}`,
                    }}
                  />
                ))}
                {weekLayout.map(({ entry, row, colStart, colSpan }) => {
                  const dropDay = plan.weekDays[colStart] ?? entry.start_date;
                  return (
                    <div
                      key={entry.id}
                      className="schedule-week-entry-slot"
                      style={{
                        gridColumn: `${colStart + 1} / span ${colSpan}`,
                        gridRow: row + 1,
                      }}
                    >
                      <DroppableDay
                        id={`entry-drop-${entry.id}`}
                        data={{ scheduleDay: dropDay }}
                        className="schedule-week-entry-drop"
                      >
                        <EntryCard
                          entry={entry}
                          conflict={conflictEntryIds.has(entry.id)}
                          onEdit={() => openEdit(entry)}
                          draggable={canManage}
                          now={now}
                        />
                      </DroppableDay>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              className={`schedule-weekend-toggle${weekendHasEntries && !weekendExpanded ? ' schedule-weekend-toggle-hint' : ''}${weekendExpanded ? ' is-expanded' : ''}`}
              onClick={() => setWeekendExpanded((open) => !open)}
              aria-expanded={weekendExpanded}
              aria-label={weekendExpanded ? 'Wochenende einklappen' : 'Samstag und Sonntag anzeigen'}
            >
              {weekendExpanded ? (
                <>
                  <span className="schedule-weekend-toggle-icon" aria-hidden>
                    ←
                  </span>
                  <span className="schedule-weekend-toggle-label">Mo–Fr</span>
                </>
              ) : (
                <>
                  <span className="schedule-weekend-toggle-label">Sa–So</span>
                  <span className="schedule-weekend-toggle-sub muted">Wochenende</span>
                  <span className="schedule-weekend-toggle-icon" aria-hidden>
                    →
                  </span>
                </>
              )}
            </button>
            </div>
          </div>
        ) : (
          <>
          <nav className="schedule-day-tabs" aria-label="Tag wählen">
            {plan.weekDays.map((day, i) => {
              const count = plan.entries.filter((e) => entrySpansDay(e, day)).length;
              return (
                <Link
                  key={day}
                  href={`/app/einsatzplanung?week=${plan.weekStart}&view=day&day=${day}`}
                  className={`schedule-day-tab${day === selectedDay ? ' is-active' : ''}`}
                  aria-current={day === selectedDay ? 'date' : undefined}
                >
                  <span>{dayLabels[i]}</span>
                  <small>{formatGermanDate(day, { day: '2-digit', month: '2-digit' })}</small>
                  {count > 0 ? <span className="schedule-day-tab-count">{count}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="schedule-day-board">
            {dayEntries.length === 0 ? (
              <p className="muted">Keine Einsätze an diesem Tag.</p>
            ) : (
              dayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`schedule-day-column ${entryCardClassName(entry, conflictEntryIds.has(entry.id), now)}`}
                >
                  <div className="schedule-day-column-head">
                    <span className="schedule-entry-code">{entry.leaderLabel}</span>
                    <strong>{entry.site.name}</strong>
                    <small>{entry.start_time}–{entry.end_time}</small>
                  </div>
                  <ul>
                    {entry.members.map((m) => (
                      <li key={m.user_id}>{m.first_name} {m.last_name}</li>
                    ))}
                    {entry.external_workers_text ? <li>{entry.external_workers_text}</li> : null}
                    {entry.equipmentLabel ? <li>{entry.equipmentLabel}</li> : null}
                  </ul>
                  {entry.notes ? <p className="muted">{entry.notes}</p> : null}
                  {canManage ? (
                    <button type="button" className="secondary-button secondary-button--compact" onClick={() => openEdit(entry)}>
                      Bearbeiten
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
          </>
        )}
        <DragOverlay dropAnimation={null}>
          {activeDrag?.kind === 'site' ? (
            <span className="schedule-chip schedule-chip-overlay">
              {sites.find((s) => s.id === activeDrag.siteId)?.name ?? 'Baustelle'}
            </span>
          ) : null}
          {activeDrag?.kind === 'entry' ? (
            <span className="schedule-chip schedule-chip-overlay">Einsatz verschieben</span>
          ) : null}
        </DragOverlay>
        </ScheduleDndRoot>
      </DndContext>

      {canShare ? (
        <PromptDialog
          open={emailDialogOpen}
          onClose={() => setEmailDialogOpen(false)}
          onSubmit={sendEmail}
          title="Einsatzplan per E-Mail"
          message="PDF wird als Anhang versendet."
          label="Empfänger-Adresse"
          defaultValue=""
          inputType="email"
          submitLabel="Senden"
          pending={emailPending}
        />
      ) : null}

      {canManage ? (
        <ScheduleEntryDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          entry={dialogEntry}
          sites={sites}
          employees={employees}
          foremen={plan.foremen}
          subcontractors={plan.subcontractors}
          equipment={plan.equipment}
          defaultSiteId={dialogDefaults.siteId}
          defaultDay={dialogDefaults.day ?? selectedDay}
        />
      ) : null}
    </div>
  );
}
