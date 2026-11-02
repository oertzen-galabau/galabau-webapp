import type { TenantTimeTrackingRules, TimeBlockType } from '@/lib/types/database';
import { parseTime } from '@/lib/utils/time';

export type SuggestConfidence = 'high' | 'medium' | 'low';

export type PauseSuggestion = {
  blockType: TimeBlockType;
  confidence: SuggestConfidence;
};

function minutesSince(isoFrom: string, isoTo: string): number {
  const from = Date.parse(isoFrom);
  const to = Date.parse(isoTo);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0;
  return Math.floor((to - from) / 60_000);
}

function pauseDurationMinutes(startedAt: string, endedAt: string): number {
  const a = Date.parse(startedAt);
  const b = Date.parse(endedAt);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.floor((b - a) / 60_000);
}

function clockMinuteFromIso(iso: string, timeZone = 'Europe/Berlin'): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function inWindow(minute: number, windowStart: string, windowEnd: string): boolean {
  const start = parseTime(windowStart.slice(0, 5)) ?? 0;
  const end = parseTime(windowEnd.slice(0, 5)) ?? 24 * 60;
  return minute >= start && minute <= end;
}

export function suggestPauseBlockType(params: {
  workDate: string;
  dayStartIso: string;
  pauseStartedAt: string;
  pauseEndedAt: string;
  pauseIndex: number;
  rules: TenantTimeTrackingRules;
  timeZone?: string;
}): PauseSuggestion {
  const timeZone = params.timeZone ?? 'Europe/Berlin';
  const duration = pauseDurationMinutes(params.pauseStartedAt, params.pauseEndedAt);
  const startMinute = clockMinuteFromIso(params.pauseStartedAt, timeZone);
  const minutesAfterClockIn = minutesSince(params.dayStartIso, params.pauseStartedAt);

  if (params.pauseIndex === 0 && minutesAfterClockIn < 120) {
    return { blockType: 'travel', confidence: minutesAfterClockIn < 60 ? 'high' : 'medium' };
  }

  if (
    params.rules.breakfast_enabled &&
    inWindow(startMinute, params.rules.breakfast_window_start, params.rules.breakfast_window_end) &&
    duration >= Math.max(5, params.rules.breakfast_expected_minutes - 10) &&
    duration <= params.rules.breakfast_expected_minutes + 20
  ) {
    return { blockType: 'breakfast', confidence: 'high' };
  }

  if (
    params.rules.lunch_enabled &&
    inWindow(startMinute, params.rules.lunch_window_start, params.rules.lunch_window_end) &&
    duration >= Math.max(10, params.rules.lunch_expected_minutes - 15) &&
    duration <= params.rules.lunch_expected_minutes + 30
  ) {
    return { blockType: 'lunch', confidence: 'high' };
  }

  if (duration <= 20) {
    return { blockType: 'travel', confidence: 'low' };
  }

  return { blockType: 'other_work', confidence: 'low' };
}
