import { parseTime } from '@/lib/utils/time';
import type { TimeEntryInterval } from '@/lib/types/database';
import {
  computeWorkSecondsFromIntervals,
  derivePhaseFromIntervals,
} from '@/lib/time-tracking/intervals';

export type WorkDayState = 'idle' | 'working' | 'paused' | 'finished' | 'breakfast' | 'lunch';

export type TimeEntryLike = {
  start_time: string | null;
  end_time: string | null;
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  work_minutes?: number;
  travel_minutes?: number;
};

export function todayWorkDate(timeZone = 'Europe/Berlin'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

export function toTimeString(date: Date, timeZone = 'Europe/Berlin'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const second = parts.find((p) => p.type === 'second')?.value ?? '00';
  return `${hour}:${minute}:${second}`;
}

export function deriveWorkDayState(
  entry: TimeEntryLike | null,
  intervals?: TimeEntryInterval[] | null,
): WorkDayState {
  if (!entry?.start_time) return 'idle';
  if (entry.end_time) return 'finished';

  if (intervals && intervals.length > 0) {
    const phase = derivePhaseFromIntervals(
      intervals,
      Boolean(entry.end_time),
      Boolean(entry.start_time),
    );
    if (phase === 'paused') return 'paused';
    if (phase === 'finished') return 'finished';
    if (phase === 'idle') return 'idle';
    return 'working';
  }

  if (entry.breakfast_start && !entry.breakfast_end) return 'breakfast';
  if (entry.lunch_start && !entry.lunch_end) return 'lunch';
  return 'working';
}

export function workDayStateLabel(state: WorkDayState): string {
  switch (state) {
    case 'idle':
      return 'Bereit zum Start';
    case 'working':
      return 'Zeiterfassung läuft';
    case 'paused':
      return 'Pause';
    case 'breakfast':
      return 'Frühstückspause';
    case 'lunch':
      return 'Mittagspause';
    case 'finished':
      return 'Zeit gespeichert';
  }
}

/** Neutrales Label für die Header-Stempeluhr während einer Pause. */
export function headerClockStateLabel(state: WorkDayState): string {
  if (state === 'breakfast' || state === 'lunch' || state === 'paused') return 'Pause';
  if (state === 'working') return 'Arbeit läuft';
  return workDayStateLabel(state);
}

/** Kurzlabel für die kompakte Header-Stempeluhr (Platz neben der Uhr). */
export function headerClockCompactStatusLabel(state: WorkDayState): string {
  if (state === 'working') return 'Läuft';
  if (state === 'breakfast' || state === 'lunch' || state === 'paused') return 'Pause';
  if (state === 'finished') return 'Fertig';
  return 'Bereit';
}

export function timerCssState(state: WorkDayState): 'idle' | 'running' | 'paused' | 'done' {
  switch (state) {
    case 'working':
      return 'running';
    case 'paused':
    case 'breakfast':
    case 'lunch':
      return 'paused';
    case 'finished':
      return 'done';
    default:
      return 'idle';
  }
}

export function breakfastAvailable(entry: TimeEntryLike | null): boolean {
  if (!entry?.start_time || entry.end_time) return false;
  return !entry.breakfast_start;
}

export function lunchAvailable(entry: TimeEntryLike | null): boolean {
  if (!entry?.start_time || entry.end_time) return false;
  return !entry.lunch_start;
}

export function hasRecordedBreak(entry: TimeEntryLike | null): boolean {
  if (!entry) return false;
  return !!(entry.breakfast_start || entry.lunch_start);
}

export function parseTimeToSeconds(value: string | null): number | null {
  if (!value) return null;
  let raw = value.trim();
  if (raw.includes('T')) {
    raw = raw.split('T')[1]?.split(/[+Z]/)[0] ?? raw;
  } else {
    raw = raw.split(/[+Z]/)[0] ?? raw;
  }
  const segments = raw.split(':');
  if (segments.length < 2) return null;
  const h = Number(segments[0]);
  const m = Number(segments[1]);
  const s = Math.floor(Number(segments[2]?.split('.')[0] ?? 0));
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  return h * 3600 + m * 60 + s;
}

export function adjustLiveDisplaySeconds(
  serverSeconds: number,
  baselineSeconds: number | null,
): number {
  if (baselineSeconds == null) return serverSeconds;
  return Math.max(0, serverSeconds - baselineSeconds);
}

export function pauseAvailable(
  entry: TimeEntryLike | null,
  intervals?: TimeEntryInterval[] | null,
): boolean {
  if (!entry?.start_time || entry.end_time) return false;
  if (intervals && intervals.length > 0) {
    return deriveWorkDayState(entry, intervals) === 'working';
  }
  return deriveWorkDayState(entry, intervals) === 'working';
}

function secondsSinceMidnight(date: Date, timeZone = 'Europe/Berlin'): number {
  const time = toTimeString(date, timeZone);
  return parseTimeToSeconds(time) ?? 0;
}

function breakSeconds(start: string | null, end: string | null, nowSeconds: number): number {
  const breakStart = parseTimeToSeconds(start);
  if (breakStart == null) return 0;
  const breakEnd = parseTimeToSeconds(end);
  const effectiveEnd = breakEnd ?? nowSeconds;
  if (effectiveEnd <= breakStart) return 0;
  return effectiveEnd - breakStart;
}

/** Berechnet die bisherige Arbeitszeit in Sekunden (für laufende Einträge bis `now`). */
export function computeLiveWorkSeconds(
  entry: TimeEntryLike | null,
  now = new Date(),
  timeZone = 'Europe/Berlin',
  intervals?: TimeEntryInterval[] | null,
): number {
  if (!entry?.start_time) return 0;

  if (intervals && intervals.length > 0) {
    return computeWorkSecondsFromIntervals(intervals, now.getTime());
  }

  const startSeconds = parseTimeToSeconds(entry.start_time);
  if (startSeconds == null) return 0;

  if (entry.end_time) {
    return Math.max(0, (entry.work_minutes ?? 0) * 60);
  }

  const nowSeconds = secondsSinceMidnight(now, timeZone);
  if (nowSeconds <= startSeconds) return 0;

  let totalSeconds = nowSeconds - startSeconds;
  totalSeconds -= breakSeconds(entry.breakfast_start, entry.breakfast_end, nowSeconds);
  totalSeconds -= breakSeconds(entry.lunch_start, entry.lunch_end, nowSeconds);
  return Math.max(0, totalSeconds);
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function currentHour(timeZone = 'Europe/Berlin'): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  return Number(hour);
}

/** Kalenderdatum ± Tage (ISO YYYY-MM-DD), DST-sicher über UTC-Mittag. */
export function addCalendarDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Montag der Woche, die refDate enthält (Europe/Berlin). */
export function startOfWeekDate(refDate?: string, timeZone = 'Europe/Berlin'): string {
  const ref = refDate ?? todayWorkDate(timeZone);
  let cursor = ref;
  for (let i = 0; i < 7; i++) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(
      new Date(`${cursor}T12:00:00Z`),
    );
    if (weekday === 'Monday') return cursor;
    cursor = addCalendarDays(cursor, -1);
  }
  return ref;
}

export function endOfWeekDate(refDate?: string, timeZone = 'Europe/Berlin'): string {
  return addCalendarDays(startOfWeekDate(refDate, timeZone), 6);
}
