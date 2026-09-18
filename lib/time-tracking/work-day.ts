export type WorkDayState = 'idle' | 'working' | 'breakfast' | 'lunch' | 'finished';

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

export function deriveWorkDayState(entry: TimeEntryLike | null): WorkDayState {
  if (!entry?.start_time) return 'idle';
  if (entry.end_time) return 'finished';
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
    case 'breakfast':
      return 'Frühstückspause';
    case 'lunch':
      return 'Mittagspause';
    case 'finished':
      return 'Zeit gespeichert';
  }
}

export function timerCssState(state: WorkDayState): 'idle' | 'running' | 'paused' | 'done' {
  switch (state) {
    case 'working':
      return 'running';
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
  const parts = value.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  const [h, m, s = 0] = parts;
  return h * 3600 + m * 60 + s;
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
): number {
  if (!entry?.start_time) return 0;

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
