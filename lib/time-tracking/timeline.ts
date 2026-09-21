import { parseTime } from '@/lib/utils/time';
import type { TimeBlockType } from '@/lib/types/database';

export type TimelineBlockInput = {
  block_type: TimeBlockType;
  start_time: string;
  end_time: string;
  site_id?: string | null;
  travel_minutes?: number;
};

export type TimelineValidationOptions = {
  requireFullCoverage?: boolean;
};

export type TimelineValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  blocks: TimelineBlockInput[];
  workMinutes: number;
  travelMinutes: number;
  breakMinutes: number;
  statutoryBreakWarning: string | null;
};

const WORK_BLOCK_TYPES: TimeBlockType[] = ['site_work', 'travel', 'other_work'];
const BREAK_BLOCK_TYPES: TimeBlockType[] = ['breakfast', 'lunch'];

export function blockDurationMinutes(block: Pick<TimelineBlockInput, 'start_time' | 'end_time'>): number {
  const start = parseTime(block.start_time);
  const end = parseTime(block.end_time);
  if (start == null || end == null || end <= start) return 0;
  return end - start;
}

export function isTimelineMode(blocks: TimelineBlockInput[]): boolean {
  return blocks.some((b) => Boolean(b.start_time && b.end_time));
}

export function normalizeTimelineBlocks(blocks: TimelineBlockInput[]): TimelineBlockInput[] {
  return [...blocks]
    .map((block) => ({
      ...block,
      start_time: block.start_time?.slice(0, 5) ?? '',
      end_time: block.end_time?.slice(0, 5) ?? '',
      site_id: block.site_id ?? null,
    }))
    .sort((a, b) => (parseTime(a.start_time) ?? 0) - (parseTime(b.start_time) ?? 0));
}

export function validateTimeline(
  blocks: TimelineBlockInput[],
  dayStart: string,
  dayEnd: string,
  options: TimelineValidationOptions = {},
): TimelineValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requireFullCoverage = options.requireFullCoverage ?? true;
  const normalized = normalizeTimelineBlocks(blocks.filter((b) => b.start_time && b.end_time));

  if (normalized.length === 0) {
    return {
      ok: false,
      errors: ['Bitte mindestens einen Zeitblock erfassen.'],
      warnings,
      blocks: normalized,
      workMinutes: 0,
      travelMinutes: 0,
      breakMinutes: 0,
      statutoryBreakWarning: null,
    };
  }

  const startBound = parseTime(dayStart);
  const endBound = parseTime(dayEnd);
  if (startBound == null || endBound == null || endBound <= startBound) {
    errors.push('Arbeitsbeginn und Feierabend sind ungültig.');
  }

  for (const block of normalized) {
    const start = parseTime(block.start_time);
    const end = parseTime(block.end_time);
    if (start == null || end == null || end <= start) {
      errors.push('Jeder Block braucht eine gültige Von-/Bis-Zeit.');
      continue;
    }
    if (startBound != null && start < startBound) {
      errors.push(`Block ${block.start_time} beginnt vor Arbeitsbeginn.`);
    }
    if (endBound != null && end > endBound) {
      errors.push(`Block ${block.end_time} endet nach Feierabend.`);
    }
    if (block.block_type === 'site_work' && !block.site_id) {
      errors.push('Baustellenblöcke brauchen eine Baustelle.');
    }
    if (block.block_type !== 'site_work' && block.site_id) {
      errors.push('Nur Baustellenblöcke dürfen einer Baustelle zugeordnet sein.');
    }
  }

  for (let i = 0; i < normalized.length - 1; i++) {
    const currentEnd = parseTime(normalized[i].end_time)!;
    const nextStart = parseTime(normalized[i + 1].start_time)!;
    if (nextStart < currentEnd) {
      errors.push('Zeitblöcke dürfen sich nicht überschneiden.');
      break;
    }
    if (requireFullCoverage && nextStart > currentEnd) {
      errors.push('Zwischen den Blöcken gibt es ungeklärte Lücken.');
    }
  }

  if (requireFullCoverage && startBound != null && endBound != null && normalized.length > 0) {
    const firstStart = parseTime(normalized[0].start_time)!;
    const lastEnd = parseTime(normalized[normalized.length - 1].end_time)!;
    if (firstStart !== startBound) {
      errors.push('Der erste Block muss am Arbeitsbeginn starten.');
    }
    if (lastEnd !== endBound) {
      errors.push('Der letzte Block muss am Feierabend enden.');
    }
  }

  let workMinutes = 0;
  let travelMinutes = 0;
  let breakMinutes = 0;

  for (const block of normalized) {
    const duration = blockDurationMinutes(block);
    if (WORK_BLOCK_TYPES.includes(block.block_type)) {
      workMinutes += duration;
    }
    if (block.block_type === 'travel') {
      travelMinutes += duration;
    }
    if (BREAK_BLOCK_TYPES.includes(block.block_type)) {
      breakMinutes += duration;
    }
  }

  const grossMinutes =
    startBound != null && endBound != null ? endBound - startBound : workMinutes + breakMinutes;
  const statutoryBreakWarning = getStatutoryBreakWarning(grossMinutes, breakMinutes);

  if (statutoryBreakWarning) {
    warnings.push(statutoryBreakWarning);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    blocks: normalized,
    workMinutes,
    travelMinutes,
    breakMinutes,
    statutoryBreakWarning,
  };
}

export function getStatutoryBreakWarning(grossWorkMinutes: number, breakMinutes: number): string | null {
  if (grossWorkMinutes > 9 * 60 && breakMinutes < 45) {
    return 'Gesetzlich sind bei mehr als 9 Stunden mindestens 45 Minuten Pause erforderlich.';
  }
  if (grossWorkMinutes > 6 * 60 && breakMinutes < 30) {
    return 'Gesetzlich sind bei mehr als 6 Stunden mindestens 30 Minuten Pause erforderlich.';
  }
  return null;
}

export function syncLegacyPauseFields(blocks: TimelineBlockInput[]): {
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
} {
  const breakfast = blocks.find((b) => b.block_type === 'breakfast');
  const lunch = blocks.find((b) => b.block_type === 'lunch');
  return {
    breakfast_start: breakfast?.start_time ?? null,
    breakfast_end: breakfast?.end_time ?? null,
    lunch_start: lunch?.start_time ?? null,
    lunch_end: lunch?.end_time ?? null,
  };
}

export function primarySiteIdFromBlocks(blocks: TimelineBlockInput[]): string | null {
  const siteBlock = blocks.find((b) => b.block_type === 'site_work' && b.site_id);
  return siteBlock?.site_id ?? null;
}

export function buildDefaultTimeline(params: {
  startTime: string;
  endTime: string;
  breakfastStart?: string | null;
  breakfastEnd?: string | null;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  defaultSiteId?: string | null;
}): TimelineBlockInput[] {
  const blocks: TimelineBlockInput[] = [];
  const points = new Set<number>();
  const addPoint = (value: string | null | undefined) => {
    const parsed = parseTime(value ?? null);
    if (parsed != null) points.add(parsed);
  };

  addPoint(params.startTime);
  addPoint(params.endTime);
  addPoint(params.breakfastStart);
  addPoint(params.breakfastEnd);
  addPoint(params.lunchStart);
  addPoint(params.lunchEnd);

  const sorted = [...points].sort((a, b) => a - b);
  const toTime = (minutes: number) =>
    `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const fromStr = toTime(from);
    const toStr = toTime(to);

    const breakfastStart = parseTime(params.breakfastStart ?? null);
    const breakfastEnd = parseTime(params.breakfastEnd ?? null);
    const lunchStart = parseTime(params.lunchStart ?? null);
    const lunchEnd = parseTime(params.lunchEnd ?? null);

    if (
      breakfastStart != null &&
      breakfastEnd != null &&
      from >= breakfastStart &&
      to <= breakfastEnd
    ) {
      blocks.push({ block_type: 'breakfast', start_time: fromStr, end_time: toStr });
      continue;
    }
    if (lunchStart != null && lunchEnd != null && from >= lunchStart && to <= lunchEnd) {
      blocks.push({ block_type: 'lunch', start_time: fromStr, end_time: toStr });
      continue;
    }

    if (params.defaultSiteId) {
      blocks.push({
        block_type: 'site_work',
        start_time: fromStr,
        end_time: toStr,
        site_id: params.defaultSiteId,
      });
    } else {
      blocks.push({ block_type: 'other_work', start_time: fromStr, end_time: toStr });
    }
  }

  return mergeAdjacentBlocks(blocks);
}

export function mergeAdjacentBlocks(blocks: TimelineBlockInput[]): TimelineBlockInput[] {
  if (blocks.length === 0) return blocks;
  const merged: TimelineBlockInput[] = [{ ...blocks[0] }];
  for (let i = 1; i < blocks.length; i++) {
    const prev = merged[merged.length - 1];
    const current = blocks[i];
    if (
      prev.block_type === current.block_type &&
      prev.end_time === current.start_time &&
      prev.site_id === current.site_id
    ) {
      prev.end_time = current.end_time;
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

export function segmentsToPayrollTravel(segments: TimelineBlockInput[]): { travel_minutes: number }[] {
  if (!isTimelineMode(segments)) {
    return segments.map((segment) => ({ travel_minutes: segment.travel_minutes ?? 0 }));
  }
  return segments
    .filter((segment) => segment.block_type === 'travel')
    .map((segment) => ({ travel_minutes: blockDurationMinutes(segment) }));
}

export const BLOCK_TYPE_LABELS: Record<TimeBlockType, string> = {
  site_work: 'Baustelle',
  travel: 'Wegezeit',
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  other_work: 'Sonstige Arbeit',
};
