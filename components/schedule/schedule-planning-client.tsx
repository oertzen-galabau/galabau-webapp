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
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ScheduleDayTimeline } from '@/components/schedule/schedule-day-timeline';
import { ScheduleEntryDialog } from '@/components/schedule/schedule-entry-dialog';
import { AppDialog, PromptDialog } from '@/components/ui/app-dialogs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { Site } from '@/lib/types/database';

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
  const [printDayDialogOpen, setPrintDayDialogOpen] = useState(false);
  const [printDayDate, setPrintDayDate] = useState(selectedDay);
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
  const employees = plan.employees as SchedulePlanData['employees'];
  const workAreas = plan.workAreas;

  const visibleDayCount = weekendExpanded ? plan.weekDays.length : SCHEDULE_DEFAULT_VISIBLE_DAYS;

  const {
    conflictEntryIds,
    entriesByDay,
    weekendHasEntries,
    unplannedSites,
    plannedSites,
    unplannedWeekSites,
    plannedWeekSites,
  } = useMemo(() => {
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

    const weekSiteIds = new Set<string>();
    for (const entry of plan.entries) {
      if (plan.weekDays.includes(entry.start_date)) {
        weekSiteIds.add(entry.site_id);
      }
    }
    const unplannedWeek = sites.filter((s) => !weekSiteIds.has(s.id));
    const plannedWeek = sites.filter((s) => weekSiteIds.has(s.id));

    return {
      conflictEntryIds: conflictIds,
      entriesByDay: byDay,
      weekendHasEntries: weekendEntries,
      unplannedSites: unplanned,
      plannedSites: planned,
      unplannedWeekSites: unplannedWeek,
      plannedWeekSites: plannedWeek,
    };
  }, [plan.scheduleConflicts, plan.entries, plan.weekDays, sites, selectedDay]);

  const siteBarUnplanned = view === 'day' ? unplannedSites : unplannedWeekSites;
  const siteBarPlanned = view === 'day' ? plannedSites : plannedWeekSites;

  const visibleWeekDays = plan.weekDays.slice(0, visibleDayCount);

  const dayEntries = plan.entries.filter((e) => e.start_date === selectedDay);
  const selectedDayPublished = plan.publishedByDay[selectedDay] ?? false;

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

  function navigateDay(offset: number) {
    const nextDay = addDays(selectedDay, offset);
    const week = mondayOfWeek(nextDay);
    router.push(`/app/einsatzplanung?week=${week}&view=day&day=${nextDay}`);
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

  async function fetchSchedulePdf(
    mode: 'day' | 'week',
    disposition: 'attachment' | 'inline' = 'attachment',
    dayDate?: string,
  ) {
    const date = dayDate ?? selectedDay;
    const base =
      mode === 'week'
        ? `/api/schedule/pdf?mode=week&week_start=${plan.weekStart}`
        : `/api/schedule/pdf?mode=day&date=${date}`;
    const url = `${base}&disposition=${disposition}`;
    const res = await fetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error ?? 'PDF konnte nicht erstellt werden');
      return null;
    }
    return res.blob();
  }

  function pdfFileName(mode: 'day' | 'week', dayDate?: string) {
    return mode === 'week'
      ? `wochenplan-${plan.weekStart}.pdf`
      : `einsatzplan-${dayDate ?? selectedDay}.pdf`;
  }

  async function downloadSchedulePdf(mode: 'day' | 'week', dayDate?: string) {
    setActionError(null);
    const blob = await fetchSchedulePdf(mode, 'attachment', dayDate);
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = pdfFileName(mode, dayDate);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openPrintDayDialog() {
    setPrintDayDate(view === 'day' ? selectedDay : todayIsoInBerlin());
    setPrintDayDialogOpen(true);
  }

  async function shareScheduleWhatsApp() {
    const mode = view === 'week' ? 'week' : 'day';
    const blob = await fetchSchedulePdf(mode);
    if (!blob) return;
    const file = new File([blob], pdfFileName(mode), { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: mode === 'week' ? 'Wochenplan' : 'Einsatztafel',
      });
      return;
    }
    await downloadSchedulePdf(mode);
    const text =
      mode === 'week'
        ? encodeURIComponent(`Wochenplan ab ${plan.weekStart}`)
        : encodeURIComponent(`Einsatztafel ${selectedDay}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
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
          <div className="schedule-toolbar-row schedule-toolbar-row--nav">
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
            {view === 'day' ? (
              <div className="schedule-toolbar-nav" role="group" aria-label="Tag wechseln">
                <button
                  type="button"
                  className="secondary-button secondary-button--compact schedule-toolbar-icon"
                  onClick={() => navigateDay(-1)}
                  aria-label="Vorheriger Tag"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="secondary-button secondary-button--compact schedule-toolbar-icon"
                  onClick={() => navigateDay(1)}
                  aria-label="Nächster Tag"
                >
                  →
                </button>
              </div>
            ) : null}
            {view === 'week' ? (
              <div className="schedule-toolbar-nav" role="group" aria-label="Woche wechseln">
                <button type="button" className="secondary-button secondary-button--compact schedule-toolbar-icon" onClick={() => navigateWeek(-1)} aria-label="Vorherige Woche">
                  ←
                </button>
                <button type="button" className="secondary-button secondary-button--compact schedule-toolbar-icon" onClick={() => navigateWeek(1)} aria-label="Nächste Woche">
                  →
                </button>
              </div>
            ) : null}
          </div>
          <div className="schedule-toolbar-row schedule-toolbar-row--actions">
            {canManage ? (
              <div className="schedule-toolbar-group">
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
                    Vortag kopieren
                  </button>
                ) : null}
              </div>
            ) : null}
            {canPublish ? (
              <div className="schedule-toolbar-group">
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
                    className="primary-button primary-button--compact"
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
              </div>
            ) : null}
            {canShare ? (
              <div className="schedule-toolbar-group">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="secondary-button secondary-button--compact schedule-toolbar-menu-trigger">
                    PDF erstellen
                    <ChevronDown size={16} aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => void downloadSchedulePdf('week')}>
                      Wochenplan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openPrintDayDialog}>Tagesplan…</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="secondary-button secondary-button--compact schedule-toolbar-menu-trigger">
                    Teilen
                    <ChevronDown size={16} aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => void shareScheduleWhatsApp()}>
                      WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>E-Mail</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
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
              {siteBarUnplanned.length > 0 ? (
                <section className="schedule-sites-bar-group">
                  <h3 className="schedule-sidebar-group-title">
                    {view === 'day' ? 'Noch nicht eingeplant' : 'Noch nicht diese Woche eingeplant'}
                    <span className="schedule-sidebar-group-count">{siteBarUnplanned.length}</span>
                  </h3>
                  <div className="schedule-chip-list">
                    {siteBarUnplanned.map((s) => renderSiteChip(s))}
                  </div>
                </section>
              ) : null}
              {siteBarPlanned.length > 0 ? (
                <section className="schedule-sites-bar-group">
                  <h3 className="schedule-sidebar-group-title">
                    {view === 'day' ? 'An diesem Tag eingeplant' : 'Diese Woche eingeplant'}
                    <span className="schedule-sidebar-group-count">{siteBarPlanned.length}</span>
                  </h3>
                  <div className="schedule-chip-list">
                    {siteBarPlanned.map((site) => renderSiteChip(site, { planned: true }))}
                  </div>
                </section>
              ) : null}
              {sites.length === 0 ? (
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
          <DroppableDay
            id={`day-${selectedDay}`}
            data={{ scheduleDay: selectedDay }}
            markDay
            className="schedule-day-timeline-drop"
          >
            <ScheduleDayTimeline
              entries={dayEntries}
              selectedDay={selectedDay}
              now={now}
              canManage={canManage}
              conflictEntryIds={conflictEntryIds}
              onEdit={openEdit}
            />
          </DroppableDay>
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
        <AppDialog
          open={printDayDialogOpen}
          onClose={() => setPrintDayDialogOpen(false)}
          title="Tagesplan als PDF"
          footer={
            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => setPrintDayDialogOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="primary-button primary-button--compact"
                onClick={() => {
                  void downloadSchedulePdf('day', printDayDate);
                  setPrintDayDialogOpen(false);
                }}
              >
                PDF erstellen
              </button>
            </div>
          }
        >
          <label className="schedule-print-day-field">
            Datum
            <input
              type="date"
              value={printDayDate}
              onChange={(e) => setPrintDayDate(e.target.value)}
            />
          </label>
        </AppDialog>
      ) : null}

      {canShare ? (
        <PromptDialog
          open={emailDialogOpen}
          onClose={() => setEmailDialogOpen(false)}
          onSubmit={sendEmail}
          title={view === 'week' ? 'Wochenplan per E-Mail' : 'Tagesplan per E-Mail'}
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
          workAreas={workAreas}
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
