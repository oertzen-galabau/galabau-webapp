import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertBreakReasonsProvided,
  evaluateBreakCompliance,
  loadTenantTimeTrackingRules,
  placeExpectedBreakTimes,
} from '@/lib/time-tracking/break-rules';
import {
  alignTimelineToDayBounds,
  isTimelineMode,
  primarySiteIdFromBlocks,
  syncLegacyPauseFields,
  validateTimeline,
  type TimelineBlockInput,
} from '@/lib/time-tracking/timeline';
import { parseTime } from '@/lib/utils/time';

export type TimeEntrySubmissionInput = {
  start_time: string;
  end_time: string;
  breakfast_start?: string | null;
  breakfast_end?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  missing_breakfast_reason?: string | null;
  missing_lunch_reason?: string | null;
  notes?: string | null;
  segments: TimelineBlockInput[];
};

export type ProcessedTimeEntrySubmission = {
  start_time: string;
  end_time: string;
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  missing_breakfast_reason: string | null;
  missing_lunch_reason: string | null;
  work_minutes: number;
  travel_minutes: number;
  site_id: string | null;
  segments: TimelineBlockInput[];
  timelineWarnings: string[];
};

export async function processTimeEntrySubmission(
  supabase: SupabaseClient,
  tenantId: string,
  input: TimeEntrySubmissionInput,
): Promise<ProcessedTimeEntrySubmission> {
  const startMinutes = parseTime(input.start_time);
  const endMinutes = parseTime(input.end_time);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
    throw new Error('Start- und Endzeit sind ungültig.');
  }

  const grossWorkMinutes = endMinutes - startMinutes;
  const rules = await loadTenantTimeTrackingRules(supabase, tenantId);
  const timelineMode = isTimelineMode(input.segments);

  let segments = input.segments;
  let breakfast_start = input.breakfast_start ?? null;
  let breakfast_end = input.breakfast_end ?? null;
  let lunch_start = input.lunch_start ?? null;
  let lunch_end = input.lunch_end ?? null;
  let work_minutes = 0;
  let travel_minutes = 0;
  const timelineWarnings: string[] = [];

  if (timelineMode) {
    segments = alignTimelineToDayBounds(segments, input.start_time, input.end_time);
    const validation = validateTimeline(segments, input.start_time, input.end_time, {
      requireFullCoverage: true,
    });
    if (!validation.ok) {
      throw new Error(validation.errors[0] ?? 'Die Tagesaufteilung ist ungültig.');
    }
    timelineWarnings.push(...validation.warnings);
    segments = validation.blocks;
    work_minutes = validation.workMinutes;
    travel_minutes = validation.travelMinutes;

    const syncedPauses = syncLegacyPauseFields(segments);
    breakfast_start = syncedPauses.breakfast_start;
    breakfast_end = syncedPauses.breakfast_end;
    lunch_start = syncedPauses.lunch_start;
    lunch_end = syncedPauses.lunch_end;
  } else {
    const placed = placeExpectedBreakTimes({
      startTime: input.start_time,
      endTime: input.end_time,
      rules,
      breakfast: { start: breakfast_start, end: breakfast_end },
      lunch: { start: lunch_start, end: lunch_end },
      skipBreakfast: Boolean(input.missing_breakfast_reason?.trim()),
      skipLunch: Boolean(input.missing_lunch_reason?.trim()),
    });
    breakfast_start = placed.breakfast_start;
    breakfast_end = placed.breakfast_end;
    lunch_start = placed.lunch_start;
    lunch_end = placed.lunch_end;

    work_minutes = grossWorkMinutes;
    const breakfastStart = parseTime(breakfast_start);
    const breakfastEnd = parseTime(breakfast_end);
    if (breakfastStart != null && breakfastEnd != null && breakfastEnd > breakfastStart) {
      work_minutes -= breakfastEnd - breakfastStart;
    }
    const lunchStart = parseTime(lunch_start);
    const lunchEnd = parseTime(lunch_end);
    if (lunchStart != null && lunchEnd != null && lunchEnd > lunchStart) {
      work_minutes -= lunchEnd - lunchStart;
    }
    travel_minutes = segments.reduce((sum, segment) => sum + (segment.travel_minutes ?? 0), 0);
    work_minutes = Math.max(0, work_minutes);
  }

  const compliance = evaluateBreakCompliance({
    rules,
    grossWorkMinutes,
    blocks: segments,
    trackedBreakfast: { start: breakfast_start, end: breakfast_end },
    trackedLunch: { start: lunch_start, end: lunch_end },
    missingBreakfastReason: input.missing_breakfast_reason,
    missingLunchReason: input.missing_lunch_reason,
  });

  assertBreakReasonsProvided(compliance, {
    missingBreakfastReason: input.missing_breakfast_reason,
    missingLunchReason: input.missing_lunch_reason,
  });

  timelineWarnings.push(...compliance.warnings);

  return {
    start_time: input.start_time,
    end_time: input.end_time,
    breakfast_start,
    breakfast_end,
    lunch_start,
    lunch_end,
    missing_breakfast_reason: compliance.missingBreakfastReasonRequired
      ? input.missing_breakfast_reason?.trim() ?? null
      : null,
    missing_lunch_reason: compliance.missingLunchReasonRequired
      ? input.missing_lunch_reason?.trim() ?? null
      : null,
    work_minutes,
    travel_minutes,
    site_id: primarySiteIdFromBlocks(segments) ?? segments.find((s) => s.site_id)?.site_id ?? null,
    segments,
    timelineWarnings,
  };
}
