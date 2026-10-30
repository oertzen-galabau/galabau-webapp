import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantTimeTrackingRules } from '@/lib/types/database';
import { blockDurationMinutes, type TimelineBlockInput } from '@/lib/time-tracking/timeline';
import { parseTime } from '@/lib/utils/time';

export const DEFAULT_TIME_TRACKING_RULES: Omit<TenantTimeTrackingRules, 'tenant_id' | 'updated_at'> = {
  breakfast_enabled: true,
  breakfast_min_work_minutes: 240,
  breakfast_expected_minutes: 15,
  breakfast_window_start: '08:00',
  breakfast_window_end: '10:30',
  lunch_enabled: true,
  lunch_min_work_minutes: 361,
  lunch_expected_minutes: 30,
  lunch_window_start: '11:00',
  lunch_window_end: '14:30',
};

export type BreakExpectation = {
  kind: 'breakfast' | 'lunch';
  label: string;
  expectedMinutes: number;
  windowStart: string;
  windowEnd: string;
};

export type BreakComplianceResult = {
  expectations: BreakExpectation[];
  missingBreakfastReasonRequired: boolean;
  missingLunchReasonRequired: boolean;
  warnings: string[];
};

export async function loadTenantTimeTrackingRules(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TenantTimeTrackingRules> {
  const { data } = await supabase
    .from('tenant_time_tracking_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!data) {
    return {
      tenant_id: tenantId,
      ...DEFAULT_TIME_TRACKING_RULES,
      updated_at: new Date().toISOString(),
    };
  }

  return data as TenantTimeTrackingRules;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function hasCompleteBreak(times?: { start: string | null; end: string | null }): boolean {
  if (!times) return false;
  const start = parseTime(times.start);
  const end = parseTime(times.end);
  return start != null && end != null && end > start;
}

function placeBreakInDay(
  dayStart: number,
  dayEnd: number,
  windowStart: string,
  windowEnd: string,
  duration: number,
): { start: string; end: string } | null {
  if (duration <= 0) return null;
  const winStart = parseTime(windowStart) ?? dayStart;
  const start = Math.max(dayStart, winStart);
  const end = start + duration;
  if (end > dayEnd) return null;
  const winEnd = parseTime(windowEnd);
  if (winEnd != null && start >= winEnd) return null;
  return { start: minutesToTime(start), end: minutesToTime(end) };
}

/** Setzt erwartete Pausen ins Zeitfenster, wenn der Nutzer nur Start/Ende angibt. */
export function placeExpectedBreakTimes(params: {
  startTime: string;
  endTime: string;
  rules: TenantTimeTrackingRules;
  breakfast?: { start: string | null; end: string | null };
  lunch?: { start: string | null; end: string | null };
  skipBreakfast?: boolean;
  skipLunch?: boolean;
}): {
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
} {
  const keepBreakfast = hasCompleteBreak(params.breakfast);
  const keepLunch = hasCompleteBreak(params.lunch);
  const fallback = {
    breakfast_start: keepBreakfast ? params.breakfast!.start : null,
    breakfast_end: keepBreakfast ? params.breakfast!.end : null,
    lunch_start: keepLunch ? params.lunch!.start : null,
    lunch_end: keepLunch ? params.lunch!.end : null,
  };

  const dayStart = parseTime(params.startTime);
  const dayEnd = parseTime(params.endTime);
  if (dayStart == null || dayEnd == null || dayEnd <= dayStart) return fallback;

  const expectations = getBreakExpectations(params.rules, dayEnd - dayStart);
  let breakfast_start = fallback.breakfast_start;
  let breakfast_end = fallback.breakfast_end;
  let lunch_start = fallback.lunch_start;
  let lunch_end = fallback.lunch_end;

  const breakfastExpected = expectations.find((item) => item.kind === 'breakfast');
  if (!keepBreakfast && !params.skipBreakfast && breakfastExpected) {
    const placed = placeBreakInDay(
      dayStart,
      dayEnd,
      breakfastExpected.windowStart,
      breakfastExpected.windowEnd,
      breakfastExpected.expectedMinutes,
    );
    if (placed) {
      breakfast_start = placed.start;
      breakfast_end = placed.end;
    }
  }

  const lunchExpected = expectations.find((item) => item.kind === 'lunch');
  if (!keepLunch && !params.skipLunch && lunchExpected) {
    const placed = placeBreakInDay(
      dayStart,
      dayEnd,
      lunchExpected.windowStart,
      lunchExpected.windowEnd,
      lunchExpected.expectedMinutes,
    );
    if (placed) {
      lunch_start = placed.start;
      lunch_end = placed.end;
    }
  }

  return { breakfast_start, breakfast_end, lunch_start, lunch_end };
}

export function getBreakExpectations(
  rules: TenantTimeTrackingRules,
  grossWorkMinutes: number,
): BreakExpectation[] {
  const expectations: BreakExpectation[] = [];

  if (rules.breakfast_enabled && grossWorkMinutes >= rules.breakfast_min_work_minutes) {
    expectations.push({
      kind: 'breakfast',
      label: 'Frühstück',
      expectedMinutes: rules.breakfast_expected_minutes,
      windowStart: rules.breakfast_window_start.slice(0, 5),
      windowEnd: rules.breakfast_window_end.slice(0, 5),
    });
  }

  if (rules.lunch_enabled && grossWorkMinutes >= rules.lunch_min_work_minutes) {
    expectations.push({
      kind: 'lunch',
      label: 'Mittag',
      expectedMinutes: rules.lunch_expected_minutes,
      windowStart: rules.lunch_window_start.slice(0, 5),
      windowEnd: rules.lunch_window_end.slice(0, 5),
    });
  }

  return expectations;
}

function breakMinutesInWindow(
  blocks: TimelineBlockInput[],
  blockType: 'breakfast' | 'lunch',
  windowStart: string,
  windowEnd: string,
): number {
  const windowStartMinutes = parseTime(windowStart) ?? 0;
  const windowEndMinutes = parseTime(windowEnd) ?? 24 * 60;

  return blocks
    .filter((block) => block.block_type === blockType)
    .reduce((sum, block) => {
      const start = parseTime(block.start_time) ?? 0;
      const end = parseTime(block.end_time) ?? 0;
      const overlapStart = Math.max(start, windowStartMinutes);
      const overlapEnd = Math.min(end, windowEndMinutes);
      return sum + Math.max(0, overlapEnd - overlapStart);
    }, 0);
}

function trackedBreakMinutes(
  blocks: TimelineBlockInput[],
  tracked: { start: string | null; end: string | null },
  blockType: 'breakfast' | 'lunch',
): number {
  const fromBlocks = blocks
    .filter((block) => block.block_type === blockType)
    .reduce((sum, block) => sum + blockDurationMinutes(block), 0);
  if (fromBlocks > 0) return fromBlocks;

  const start = parseTime(tracked.start);
  const end = parseTime(tracked.end);
  if (start == null || end == null || end <= start) return 0;
  return end - start;
}

export function evaluateBreakCompliance(params: {
  rules: TenantTimeTrackingRules;
  grossWorkMinutes: number;
  blocks: TimelineBlockInput[];
  trackedBreakfast: { start: string | null; end: string | null };
  trackedLunch: { start: string | null; end: string | null };
  missingBreakfastReason?: string | null;
  missingLunchReason?: string | null;
}): BreakComplianceResult {
  const expectations = getBreakExpectations(params.rules, params.grossWorkMinutes);
  const warnings: string[] = [];

  const breakfastExpected = expectations.find((item) => item.kind === 'breakfast');
  const lunchExpected = expectations.find((item) => item.kind === 'lunch');

  const breakfastMinutes = breakfastExpected
    ? Math.max(
        trackedBreakMinutes(params.blocks, params.trackedBreakfast, 'breakfast'),
        breakMinutesInWindow(
          params.blocks,
          'breakfast',
          breakfastExpected.windowStart,
          breakfastExpected.windowEnd,
        ),
      )
    : 0;

  const lunchMinutes = lunchExpected
    ? Math.max(
        trackedBreakMinutes(params.blocks, params.trackedLunch, 'lunch'),
        breakMinutesInWindow(
          params.blocks,
          'lunch',
          lunchExpected.windowStart,
          lunchExpected.windowEnd,
        ),
      )
    : 0;

  const missingBreakfastReasonRequired =
    !!breakfastExpected && breakfastMinutes < breakfastExpected.expectedMinutes;
  const missingLunchReasonRequired =
    !!lunchExpected && lunchMinutes < lunchExpected.expectedMinutes;

  if (missingBreakfastReasonRequired && !params.missingBreakfastReason?.trim()) {
    warnings.push('Für fehlendes Frühstück ist ein Grund erforderlich.');
  }
  if (missingLunchReasonRequired && !params.missingLunchReason?.trim()) {
    warnings.push('Für fehlende Mittagspause ist ein Grund erforderlich.');
  }

  return {
    expectations,
    missingBreakfastReasonRequired,
    missingLunchReasonRequired,
    warnings,
  };
}

export function assertBreakReasonsProvided(compliance: BreakComplianceResult, reasons: {
  missingBreakfastReason?: string | null;
  missingLunchReason?: string | null;
}) {
  if (compliance.missingBreakfastReasonRequired && !reasons.missingBreakfastReason?.trim()) {
    throw new Error('Bitte einen Grund für die fehlende Frühstückspause angeben.');
  }
  if (compliance.missingLunchReasonRequired && !reasons.missingLunchReason?.trim()) {
    throw new Error('Bitte einen Grund für die fehlende Mittagspause angeben.');
  }
}
