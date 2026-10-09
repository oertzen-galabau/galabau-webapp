const BERLIN = 'Europe/Berlin';

export type ScheduleEntryPhase = 'past' | 'active' | 'future';

export type ScheduleEntryTiming = {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function isoDateInBerlin(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN }).format(at);
}

export function minutesSinceMidnightInBerlin(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Vergangen / läuft gerade / noch bevorstehend (Europe/Berlin). */
export function scheduleEntryPhase(
  entry: ScheduleEntryTiming,
  at: Date = new Date(),
): ScheduleEntryPhase {
  const today = isoDateInBerlin(at);
  const nowMin = minutesSinceMidnightInBerlin(at);
  const startMin = timeToMinutes(entry.start_time);
  const endMin = timeToMinutes(entry.end_time);

  if (today < entry.start_date) return 'future';
  if (today > entry.end_date) return 'past';

  if (today === entry.start_date && today === entry.end_date) {
    if (nowMin < startMin) return 'future';
    if (nowMin >= endMin) return 'past';
    return 'active';
  }

  if (today === entry.start_date) {
    if (nowMin < startMin) return 'future';
    return 'active';
  }

  if (today === entry.end_date) {
    if (nowMin >= endMin) return 'past';
    return 'active';
  }

  return 'active';
}
