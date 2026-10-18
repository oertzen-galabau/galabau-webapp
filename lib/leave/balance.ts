import type { SupabaseClient } from '@supabase/supabase-js';
import {
  automaticCarryFromPreviousRemaining,
  computeEffectiveCarriedOver,
  countMandatoryDaysBeforeExpiry,
  countUrlaubDaysBeforeExpiry,
  type ApprovedUrlaubRange,
  type LeaveCarryExpiry,
} from '@/lib/leave/carry-over';
import { isBadWeatherForBooking } from '@/lib/payroll/bad-weather-entry';
import { isBadWeatherSeason } from '@/lib/payroll/constants';
import {
  getBadWeatherSeasonFromConfig,
  loadTenantPayrollConfig,
  type BadWeatherConfig,
} from '@/lib/payroll/tenant-rules';
import { todayIsoInBerlin } from '@/lib/schedule/week';

export const DEFAULT_BAD_WEATHER_ALLOWANCE_DAYS = 5;
import { calculateWorkMinutes } from '@/lib/utils/time';

export type LeaveBalanceRow = {
  entitlement_days?: number | null;
  carried_over_days?: number | null;
  used_days?: number | null;
  carried_over_source?: 'manual' | 'automatic' | null;
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
  /** Resturlaub nach Verfall (Stichtag). */
  effectiveCarriedOver: number;
  forfeitedCarry: number;
  /** Jahresanspruch + wirksamer Resturlaub Vorjahr. */
  totalAvailable: number;
  usedFromRequests: number;
  /** Betriebsurlaub + Brückentage (Werktage, dedupliziert). */
  mandatoryDays: number;
  /** Genutzte Schlechwetter-Tage (ohne Doppel mit Betrieb/Brücke). */
  badWeatherDays: number;
  /** Mandanten-Kontingent Schlechwetter pro Jahr (Einstellungen → Allgemein). */
  badWeatherAllowanceDays: number;
  /** Vom Resturlaub abgezogene Schlechwetter-Tage (gebucht, ohne Betrieb/Brücke). */
  badWeatherDeductionFromVacation: number;
  totalExtraDeduction: number;
  remaining: number;
  carryExpiresOn: string | null;
  beforeCarryExpiry: boolean;
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
  badWeatherAllowanceDays?: number;
  approvedUrlaub?: ApprovedUrlaubRange[];
  carryExpiry?: LeaveCarryExpiry | null;
  today?: string;
}): LeaveBalanceBreakdown {
  const entitlementDays = Number(input.balance?.entitlement_days ?? DEFAULT_ENTITLEMENT);
  const carriedOverDays = Number(input.balance?.carried_over_days ?? 0);
  const usedFromRequests = Number(input.balance?.used_days ?? 0);
  const today = input.today ?? todayIsoInBerlin();
  const expiry = input.carryExpiry ?? null;
  const urlaubBefore = expiry
    ? countUrlaubDaysBeforeExpiry(input.approvedUrlaub ?? [], input.year, expiry)
    : 0;
  const mandatoryBefore = expiry
    ? countMandatoryDaysBeforeExpiry(
        input.year,
        input.companyHolidays,
        input.bridgeDays,
        expiry,
      )
    : 0;
  const carryEffect = computeEffectiveCarriedOver({
    carriedOver: carriedOverDays,
    year: input.year,
    expiry,
    urlaubDaysBeforeExpiry: urlaubBefore,
    mandatoryDaysBeforeExpiry: mandatoryBefore,
    today,
  });
  const effectiveCarriedOver = carryEffect.effectiveCarriedOver;

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

  let badWeatherDaysUsed = 0;
  for (const d of swDates) {
    if (!mandatoryDates.has(d)) badWeatherDaysUsed += 1;
  }

  const allowanceRaw = input.badWeatherAllowanceDays;
  const badWeatherAllowanceDays =
    allowanceRaw != null && !Number.isNaN(Number(allowanceRaw))
      ? Math.max(0, Number(allowanceRaw))
      : DEFAULT_BAD_WEATHER_ALLOWANCE_DAYS;

  /** Nur tatsächlich gebuchte SW-Tage (ohne Betrieb/Brücke) reduzieren den Resturlaub. */
  const badWeatherDeductionFromVacation = badWeatherDaysUsed;

  const mandatoryDays = mandatoryDates.size;
  const totalExtraDeduction = mandatoryDays + badWeatherDeductionFromVacation;
  const totalAvailable = entitlementDays + effectiveCarriedOver;
  const remaining = totalAvailable - usedFromRequests - totalExtraDeduction;

  return {
    entitlementDays,
    carriedOverDays,
    effectiveCarriedOver,
    forfeitedCarry: carryEffect.forfeitedCarry,
    totalAvailable,
    usedFromRequests,
    mandatoryDays,
    badWeatherDays: badWeatherDaysUsed,
    badWeatherAllowanceDays,
    badWeatherDeductionFromVacation,
    totalExtraDeduction,
    remaining,
    carryExpiresOn: carryEffect.carryExpiresOn,
    beforeCarryExpiry: carryEffect.beforeExpiry,
  };
}

async function fetchLeaveYearInputs(
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
    { data: tenantRow },
    { data: approvedUrlaub },
    tenantConfig,
  ] = await Promise.all([
    supabase
      .from('leave_balances')
      .select('entitlement_days, carried_over_days, used_days, carried_over_source')
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
    supabase
      .from('tenants')
      .select('bad_weather_allowance_days, leave_carry_expire_month, leave_carry_expire_day')
      .eq('id', tenantId)
      .single(),
    supabase
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('leave_type', 'urlaub')
      .eq('status', 'approved')
      .lte('start_date', yearEnd)
      .gte('end_date', yearStart),
    loadTenantPayrollConfig(supabase, tenantId),
  ]);

  const carryExpiry =
    tenantRow?.leave_carry_expire_month != null && tenantRow?.leave_carry_expire_day != null
      ? {
          month: tenantRow.leave_carry_expire_month,
          day: tenantRow.leave_carry_expire_day,
        }
      : null;

  return {
    balance: (balance ?? null) as LeaveBalanceRow | null,
    companyHolidays: companyHolidays ?? [],
    bridgeDays: bridgeDays ?? [],
    tenantBadWeatherDays: tenantBadWeatherDays ?? [],
    timeEntries: timeEntries ?? [],
    tenantRow,
    approvedUrlaub: (approvedUrlaub ?? []) as ApprovedUrlaubRange[],
    tenantConfig,
    carryExpiry,
  };
}

function breakdownFromYearInputs(
  year: number,
  inputs: Awaited<ReturnType<typeof fetchLeaveYearInputs>>,
): LeaveBalanceBreakdown {
  const badWeatherRule = inputs.tenantConfig.rules.get('bad_weather');
  const badWeatherConfig = badWeatherRule?.config as BadWeatherConfig | undefined;

  return computeLeaveBalanceBreakdown({
    balance: inputs.balance,
    year,
    companyHolidays: inputs.companyHolidays,
    bridgeDays: inputs.bridgeDays,
    tenantBadWeatherDays: inputs.tenantBadWeatherDays,
    timeEntries: inputs.timeEntries,
    badWeatherConfig,
    badWeatherRuleEnabled: badWeatherRule?.enabled === true,
    badWeatherAllowanceDays:
      inputs.tenantRow?.bad_weather_allowance_days ?? DEFAULT_BAD_WEATHER_ALLOWANCE_DAYS,
    approvedUrlaub: inputs.approvedUrlaub,
    carryExpiry: inputs.carryExpiry,
  });
}

/** Nur lesen: Resturlaub aus Vorjahr, wenn dort ein Saldo existiert. */
export async function computeAutomaticCarriedOverDays(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  year: number,
): Promise<number> {
  const prevInputs = await fetchLeaveYearInputs(supabase, tenantId, userId, year - 1);
  if (!prevInputs.balance) return 0;
  const prevBreakdown = breakdownFromYearInputs(year - 1, prevInputs);
  return automaticCarryFromPreviousRemaining(prevBreakdown.remaining);
}

/** Schreibt automatischen Resturlaub (Admin-Aktion „neu berechnen“). */
export async function syncAutomaticCarriedOverToDb(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  year: number,
): Promise<LeaveBalanceRow | null> {
  const inputs = await fetchLeaveYearInputs(supabase, tenantId, userId, year);
  const carry = await computeAutomaticCarriedOverDays(supabase, tenantId, userId, year);

  const { data: updated, error } = await supabase
    .from('leave_balances')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        year,
        entitlement_days: inputs.balance?.entitlement_days ?? DEFAULT_ENTITLEMENT,
        carried_over_days: carry,
        used_days: inputs.balance?.used_days ?? 0,
        carried_over_source: 'automatic',
      },
      { onConflict: 'tenant_id,user_id,year' },
    )
    .select('entitlement_days, carried_over_days, used_days, carried_over_source')
    .single();

  if (error) {
    console.error('[leave] syncAutomaticCarriedOverToDb failed', error.message);
    return inputs.balance;
  }
  return updated as LeaveBalanceRow;
}

export async function loadLeaveBalanceContext(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  year: number,
) {
  let inputs = await fetchLeaveYearInputs(supabase, tenantId, userId, year);
  let balance = inputs.balance;

  if (balance?.carried_over_source === 'automatic') {
    const carry = await computeAutomaticCarriedOverDays(supabase, tenantId, userId, year);
    balance = { ...balance, carried_over_days: carry };
    inputs = { ...inputs, balance };
  }

  const breakdown = breakdownFromYearInputs(year, inputs);

  return {
    balance,
    breakdown,
    companyHolidays: inputs.companyHolidays,
    bridgeDays: inputs.bridgeDays,
    carryExpiry: inputs.carryExpiry,
    carriedOverSource: balance?.carried_over_source ?? 'manual',
  };
}
