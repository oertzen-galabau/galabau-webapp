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
  copyScheduleDay,
  copyScheduleWeek,
  moveScheduleEntry,
  publishScheduleDay,
  publishScheduleWeek,
} from '@/lib/actions/schedule';
import { scheduleEntryPhase } from '@/lib/schedule/entry-phase';
import type { SchedulePlanData } from '@/lib/schedule/load-plan-data';
import {
  addDays,
  formatGermanDate,
  mondayOfWeek,
  SCHEDULE_DEFAULT_VISIBLE_DAYS,
  SCHEDULE_WEEKEND_START_INDEX,
  todayIsoInBerlin,
  weekDayLabels,
  formatGermanWeekdayDate,
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

  const { conflictEntryIds, entriesByDay, weekendHasEntries, unplannedSites, plannedSites } = useMemo(() => {
    const conflictIds = new Set<string>();
    for (const c of plan.scheduleConflicts) {
      conflictIds.add(c.entryIds[0]);
      conflictIds.add(c.entryIds[1]);
    }

    const byDay = new Map<string, SchedulePlanData['entries']>();
    for (const day of plan.weekDays) byDay.set(day, []);
    for (const entry of plan.entries) {
      const list = byDay.get(entry.start_date);
      if (list) list.push(entry);
    }

    const weekendEntries = plan.weekDays
      .slice(SCHEDULE_WEEKEND_START_INDEX)
      .some((day) => (byDay.get(day)?.length ?? 0) > 0);

    const daySiteIds = new Set(
      (byDay.get(selectedDay) ?? []).map((e) => e.site_id),
    );
    const unplanned = sites.filter((s) => !daySiteIds.has(s.id));
    const planned = (byDay.get(selectedDay) ?? []).map((e) => e.site);

    return {
      conflictEntryIds: conflictIds,
      entriesByDay: byDay,
      weekendHasEntries: weekendEntries,
      unplannedSites: unplanned,
      plannedSites: planned,
    };
  }, [plan.scheduleConflicts, plan.entries, plan.weekDays, sites, selectedDay]);

  const visibleWeekDays = plan.weekDays.slice(0, visibleDayCount);

  const dayEntries = plan.entries.filter((e) => e.start_date === selectedDay);
  const selectedDayPublished = plan.publishedByDay[selectedDay] ?? false;

  const dayLabels = weekDayLabels();
  const today = todayIsoInBerlin();
  const weekOfToday = mondayOfWeek(today);
  const tomorrow = addDays(today, 1);
  const heuteHref = `/app/einsatzplanung?week=${weekOfToday}&view=day&day=${today}`;
  const morgenHref = `/app/einsatzplanung?week=${mondayOfWeek(tomorrow)}&view=day&day=${tomorrow}`;
  const heuteIsCurrent = view === 'day' && selectedDay === today;
  const morgenIsCurrent = view === 'day' && selectedDay === tomorrow;

  function renderSiteChip(site: Pick<Site, 'id' | 'name'>, opts?: { planned?: boolean }) {
    return (
      <DraggableChip
        key={site.id}
        id={`site-${site.id}`}
        data={{ kind: 'site', siteId: site.id }}
        className={`schedule-chip${opts?.planned ? ' schedule-chip-planned' : ''}`}
      >
        <span className="schedule-chip-name">{site.name}</span>
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
        (e) => e.site_id === payload.siteId && e.start_date === targetDay,
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
          if (entry.start_date === targetDay) return;
          fd.set('entry_id', payload.entryId);
          fd.set('target_day', targetDay);
          await moveScheduleEntry(fd);
          openEdit({ ...entry, start_date: targetDay, end_date: targetDay });
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

  async function fetchSchedulePdf(mode: 'day' | 'week', disposition: 'attachment' | 'inline' = 'attachment') {
    const base =
      mode === 'week'
        ? `/api/schedule/pdf?mode=week&week_start=${plan.weekStart}`
        : `/api/schedule/pdf?mode=day&date=${selectedDay}`;
    const url = `${base}&disposition=${disposition}`;
    const res = await fetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error ?? 'PDF konnte nicht erstellt werden');
      return null;
    }
    return res.blob();
  }

  async function sharePdf(mode: 'day' | 'week') {
    const blob = await fetchSchedulePdf(mode);
    if (!blob) return;
    const file = new File(
      [blob],
      mode === 'week' ? `wochenplan-${plan.weekStart}.pdf` : `einsatzplan-${selectedDay}.pdf`,
      { type: 'application/pdf' },
    );
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

  async function printDayPdf() {
    const blob = await fetchSchedulePdf('day', 'inline');
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="schedule-page">
      <header className="page-header schedule-header">
        <div>
          <h1>Einsatzplanung</h1>
          <p className="muted">
            {view === 'day'
              ? selectedDayPublished
                ? `Tag veröffentlicht · ${formatGermanWeekdayDate(selectedDay)}`
                : `Entwurf · ${formatGermanWeekdayDate(selectedDay)}`
              : plan.published
                ? 'Woche vollständig veröffentlicht'
                : 'Woche teilweise oder nicht veröffentlicht'}
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
            <Link
              href={morgenHref}
              className={
                morgenIsCurrent
                  ? 'secondary-button secondary-button--compact schedule-toolbar-heute is-current'
                  : 'secondary-button secondary-button--compact schedule-toolbar-heute'
              }
              aria-current={morgenIsCurrent ? 'true' : undefined}
            >
              Morgen
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
              {view === 'day' ? (
                <button
                  type="button"
                  className="secondary-button secondary-button--compact"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const fd = new FormData();
                    fd.set('target_day', selectedDay);
                    await copyScheduleDay(fd);
                    router.refresh();
                  })}
                >
                  Vortag übernehmen
                </button>
              ) : null}
            </>
          ) : null}
          {canPublish ? (
            <>
              {view === 'day' ? (
                <button
                  type="button"
                  className="primary-button primary-button--compact"
                  disabled={pending || selectedDayPublished || dayEntries.length === 0}
                  onClick={() => startTransition(async () => {
                    const fd = new FormData();
                    fd.set('plan_date', selectedDay);
                    await publishScheduleDay(fd);
                    router.refresh();
                  })}
                >
                  Tag veröffentlichen
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-button secondary-button--compact"
                  disabled={pending || plan.published}
                  onClick={() => startTransition(async () => {
                    const fd = new FormData();
                    fd.set('week_start', plan.weekStart);
                    await publishScheduleWeek(fd);
                    router.refresh();
                  })}
                >
                  Woche veröffentlichen
                </button>
              )}
            </>
          ) : null}
          {canShare ? (
            <>
              <button
                type="button"
                className="primary-button primary-button--compact"
                onClick={() => sharePdf('day')}
              >
                Tagesplan PDF
              </button>
              <button type="button" className="secondary-button secondary-button--compact" onClick={() => printDayPdf()}>
                Drucken
              </button>
              <button type="button" className="secondary-button secondary-button--compact" onClick={() => sharePdf('week')}>
                Wochenplan PDF
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
        {canManage && (view === 'day' || view === 'week') ? (
          <div className={`schedule-sites-bar${sitesCollapsed ? ' is-collapsed' : ''}`}>
            <button
              type="button"
              className="schedule-sites-bar-label"
              aria-expanded={!sitesCollapsed}
              onClick={() => setSitesCollapsed((v) => !v)}
            >
              Baustellen{view === 'day' ? ` · ${formatGermanDate(selectedDay, { weekday: 'short', day: '2-digit', month: '2-digit' })}` : ''}
              <span className="schedule-sites-bar-chevron" aria-hidden="true">{sitesCollapsed ? '▸' : '▾'}</span>
            </button>
            <div className="schedule-sites-bar-groups">
              {view === 'day' ? (
                <>
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
                        An diesem Tag eingeplant
                        <span className="schedule-sidebar-group-count">{plannedSites.length}</span>
                      </h3>
                      <div className="schedule-chip-list">
                        {plannedSites.map((site) => renderSiteChip(site, { planned: true }))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <p className="muted schedule-sites-bar-empty">
                  Baustellen per Drag-and-drop in der Wochenansicht auf einen Tag ziehen oder in der Tagesansicht planen.
                </p>
              )}
              {view === 'day' && unplannedSites.length === 0 && plannedSites.length === 0 ? (
                <p className="muted schedule-sites-bar-empty">Keine aktiven Baustellen.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {actionError ? <p className="form-error">{actionError}</p> : null}

        {!canManage && view === 'day' && !selectedDayPublished ? (
          <p className="muted">Dieser Tag wurde noch nicht veröffentlicht.</p>
        ) : null}

        {view === 'week' ? (
          <div className="schedule-board">
            <div className={`schedule-week-wrap${weekendExpanded ? ' is-weekend-expanded' : ''}`}>
            <div className={`schedule-week-grid schedule-week-grid--by-day${weekendExpanded ? ' is-weekend-expanded' : ''}`}>
              {visibleWeekDays.map((day) => {
                const labelIdx = plan.weekDays.indexOf(day);
                const isToday = day === today;
                const dayPublished = plan.publishedByDay[day] ?? false;
                const colEntries = entriesByDay.get(day) ?? [];
                return (
                  <div key={day} className="schedule-week-day-col">
                    <Link
                      href={`/app/einsatzplanung?week=${plan.weekStart}&view=day&day=${day}`}
                      className={`schedule-week-col-head schedule-week-col-head-link${isToday ? ' schedule-week-col-head-today' : ''}`}
                    >
                      <span>{weekDayLabels()[labelIdx] ?? '?'}</span>
                      <small>{formatGermanDate(day, { day: '2-digit', month: '2-digit' })}</small>
                      <small className={dayPublished ? 'schedule-day-pub schedule-day-pub--ok' : 'schedule-day-pub'}>
                        {dayPublished ? 'Veröffentlicht' : 'Entwurf'}
                      </small>
                    </Link>
                    <DroppableDay
                      id={`day-${day}`}
                      data={{ scheduleDay: day }}
                      markDay
                      className="schedule-week-day-stack"
                    >
                      {colEntries.length === 0 ? (
                        <p className="muted schedule-week-day-empty">—</p>
                      ) : (
                        colEntries.map((entry) => (
                          <EntryCard
                            key={entry.id}
                            entry={entry}
                            conflict={conflictEntryIds.has(entry.id)}
                            onEdit={() => openEdit(entry)}
                            draggable={canManage}
                            now={now}
                          />
                        ))
                      )}
                    </DroppableDay>
                  </div>
                );
              })}
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
              const count = (entriesByDay.get(day) ?? []).length;
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
          <DroppableDay
            id={`day-${selectedDay}`}
            data={{ scheduleDay: selectedDay }}
            markDay
            className="schedule-day-board"
          >
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
          </DroppableDay>
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
          weekDays={plan.weekDays}
        />
      ) : null}
    </div>
  );
}
