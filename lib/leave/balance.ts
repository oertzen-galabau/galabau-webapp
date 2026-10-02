import type { SupabaseClient } from '@supabase/supabase-js';
import { isBadWeatherForBooking } from '@/lib/payroll/bad-weather-entry';
import { isBadWeatherSeason } from '@/lib/payroll/constants';
import {
  getBadWeatherSeasonFromConfig,
  loadTenantPayrollConfig,
  type BadWeatherConfig,
} from '@/lib/payroll/tenant-rules';
import { calculateWorkMinutes } from '@/lib/utils/time';

export type LeaveBalanceRow = {
  entitlement_days?: number | null;
  carried_over_days?: number | null;
  used_days?: number | null;
};

export type CompanyHolidayRow = {
  start_date: string;
  end_date: string;
};

export type BridgeDayRow = {
  date: string;
};

export type BadWeatherDayRow = {
  work_date: string;
};

export type TimeEntryForBadWeather = {
  work_date: string;
  bad_weather_claimed?: boolean | null;
  bad_weather_confirmed?: boolean | null;
  start_time: string | null;
  end_time: string | null;
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  travel_minutes?: number;
};

export type LeaveBalanceBreakdown = {
  entitlementDays: number;
  carriedOverDays: number;
  usedFromRequests: number;
  /** Betriebsurlaub + Brückentage (Werktage, dedupliziert). */
  mandatoryDays: number;
  /** Schlechwetter-Tage, die nicht schon in mandatoryDays stecken. */
  badWeatherDays: number;
  totalExtraDeduction: number;
  remaining: number;
};

const DEFAULT_ENTITLEMENT = 30;

function isWeekday(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day !== 0 && day !== 6;
}

function clampDateRangeToYear(
  startDate: string,
  endDate: string,
  year: number,
): { start: string; end: string } | null {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const start = startDate > yearStart ? startDate : yearStart;
  const end = endDate < yearEnd ? endDate : yearEnd;
  if (start > end) return null;
  return { start, end };
}

function addWeekdaysInRange(dates: Set<string>, start: string, end: string) {
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    const iso = cur.toISOString().slice(0, 10);
    if (isWeekday(iso)) dates.add(iso);
    cur.setDate(cur.getDate() + 1);
  }
}

/** Eindeutige Werktage aus Betriebsurlaub-Zeiträumen und Brückentagen im Jahr. */
export function collectMandatoryLeaveDates(
  year: number,
  companyHolidays: CompanyHolidayRow[],
  bridgeDays: BridgeDayRow[],
): Set<string> {
  const dates = new Set<string>();

  for (const holiday of companyHolidays) {
    const clipped = clampDateRangeToYear(holiday.start_date, holiday.end_date, year);
    if (clipped) addWeekdaysInRange(dates, clipped.start, clipped.end);
  }

  for (const bridge of bridgeDays) {
    const d = bridge.date;
    if (d.slice(0, 4) === String(year) && isWeekday(d)) dates.add(d);
  }

  return dates;
}

export function countMandatoryLeaveDays(
  year: number,
  companyHolidays: CompanyHolidayRow[],
  bridgeDays: BridgeDayRow[],
): number {
  return collectMandatoryLeaveDates(year, companyHolidays, bridgeDays).size;
}

function entryNetWorkMinutes(entry: TimeEntryForBadWeather): number {
  return calculateWorkMinutes({
    start_time: entry.start_time,
    end_time: entry.end_time,
    breakfast_start: entry.breakfast_start,
    breakfast_end: entry.breakfast_end,
    lunch_start: entry.lunch_start,
    lunch_end: entry.lunch_end,
    travel_minutes: entry.travel_minutes,
  });
}

/** Kalendertage mit finaler Schlechwetter-Wirkung (Saison + Mindest-Arbeitszeit wie Lohn). */
export function collectBadWeatherLeaveDates(
  year: number,
  tenantBadWeatherDays: BadWeatherDayRow[],
  timeEntries: TimeEntryForBadWeather[],
  badWeatherConfig?: BadWeatherConfig,
  badWeatherRuleEnabled = true,
): Set<string> {
  const dates = new Set<string>();
  if (!badWeatherRuleEnabled) return dates;

  const { season_start, season_end } = getBadWeatherSeasonFromConfig(badWeatherConfig);
  const minWork = badWeatherConfig?.min_work_minutes ?? 60;
  const tenantMarked = new Set(
    tenantBadWeatherDays
      .filter((d) => d.work_date.startsWith(`${year}-`))
      .map((d) => d.work_date),
  );

  for (const entry of timeEntries) {
    if (!entry.work_date.startsWith(`${year}-`)) continue;
    if (!isBadWeatherSeason(entry.work_date, season_start, season_end)) continue;
    if (!isBadWeatherForBooking(entry, tenantMarked.has(entry.work_date))) continue;
    if (entryNetWorkMinutes(entry) < minWork) continue;
    dates.add(entry.work_date);
  }

  return dates;
}

/**
 * Resturlaub inkl. Abzügen für Betriebsurlaub, Brückentage und Schlechwetter.
 * Betrieb/Brücke werden nicht in used_days geschrieben — nur bei der Rest-Anzeige abgezogen.
 */
export function computeLeaveBalanceBreakdown(input: {
  balance: LeaveBalanceRow | null;
  year: number;
  companyHolidays: CompanyHolidayRow[];
  bridgeDays: BridgeDayRow[];
  tenantBadWeatherDays: BadWeatherDayRow[];
  timeEntries: TimeEntryForBadWeather[];
  badWeatherConfig?: BadWeatherConfig;
  badWeatherRuleEnabled?: boolean;
}): LeaveBalanceBreakdown {
  const entitlementDays = Number(input.balance?.entitlement_days ?? DEFAULT_ENTITLEMENT);
  const carriedOverDays = Number(input.balance?.carried_over_days ?? 0);
  const usedFromRequests = Number(input.balance?.used_days ?? 0);

  const mandatoryDates = collectMandatoryLeaveDates(
    input.year,
    input.companyHolidays,
    input.bridgeDays,
  );
  const swDates = collectBadWeatherLeaveDates(
    input.year,
    input.tenantBadWeatherDays,
    input.timeEntries,
    input.badWeatherConfig,
    input.badWeatherRuleEnabled ?? true,
  );

  let badWeatherOnly = 0;
  for (const d of swDates) {
    if (!mandatoryDates.has(d)) badWeatherOnly += 1;
  }

  const mandatoryDays = mandatoryDates.size;
  const totalExtraDeduction = mandatoryDays + badWeatherOnly;
  const remaining =
    entitlementDays + carriedOverDays - usedFromRequests - totalExtraDeduction;

  return {
    entitlementDays,
    carriedOverDays,
    usedFromRequests,
    mandatoryDays,
    badWeatherDays: badWeatherOnly,
    totalExtraDeduction,
    remaining,
  };
}

export async function loadLeaveBalanceContext(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  year: number,
) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [
    { data: balance },
    { data: companyHolidays },
    { data: bridgeDays },
    { data: tenantBadWeatherDays },
    { data: timeEntries },
    tenantConfig,
  ] = await Promise.all([
    supabase
      .from('leave_balances')
      .select('entitlement_days, carried_over_days, used_days')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('year', year)
      .maybeSingle(),
    supabase
      .from('company_holidays')
      .select('id, title, start_date, end_date')
      .eq('tenant_id', tenantId)
      .gte('end_date', yearStart),
    supabase
      .from('bridge_days')
      .select('id, title, date')
      .eq('tenant_id', tenantId)
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date'),
    supabase
      .from('bad_weather_days')
      .select('work_date')
      .eq('tenant_id', tenantId)
      .gte('work_date', yearStart)
      .lte('work_date', yearEnd),
    supabase
      .from('time_entries')
      .select(
        'work_date, bad_weather_claimed, bad_weather_confirmed, start_time, end_time, breakfast_start, breakfast_end, lunch_start, lunch_end, travel_minutes',
      )
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .gte('work_date', yearStart)
      .lte('work_date', yearEnd),
    loadTenantPayrollConfig(supabase, tenantId),
  ]);

  const badWeatherRule = tenantConfig.rules.get('bad_weather');
  const badWeatherConfig = badWeatherRule?.config as BadWeatherConfig | undefined;

  const breakdown = computeLeaveBalanceBreakdown({
    balance,
    year,
    companyHolidays: companyHolidays ?? [],
    bridgeDays: bridgeDays ?? [],
    tenantBadWeatherDays: tenantBadWeatherDays ?? [],
    timeEntries: timeEntries ?? [],
    badWeatherConfig,
    badWeatherRuleEnabled: badWeatherRule?.enabled === true,
  });

  return {
    balance,
    breakdown,
    companyHolidays: companyHolidays ?? [],
    bridgeDays: bridgeDays ?? [],
  };
}
