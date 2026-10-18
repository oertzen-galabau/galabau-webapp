import { collectMandatoryLeaveDates } from '@/lib/leave/balance';
import type { CompanyHolidayRow, BridgeDayRow } from '@/lib/leave/balance';
import { businessDaysBetween } from '@/lib/utils/time';
import { todayIsoInBerlin } from '@/lib/schedule/week';

export type LeaveCarryExpiry = {
  month: number;
  day: number;
};

export type ApprovedUrlaubRange = {
  start_date: string;
  end_date: string;
};

export function expiryIsoInYear(year: number, expiry: LeaveCarryExpiry): string {
  const m = String(expiry.month).padStart(2, '0');
  const d = String(expiry.day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function formatCarryExpiryLabel(expiry: LeaveCarryExpiry): string {
  const iso = expiryIsoInYear(2000, expiry);
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(date);
}

/** Werktage genehmigten Urlaubs bis einschließlich Stichtag (Schnitt mit Antragszeitraum). */
export function countUrlaubDaysBeforeExpiry(
  requests: ApprovedUrlaubRange[],
  year: number,
  expiry: LeaveCarryExpiry,
): number {
  const cutoff = expiryIsoInYear(year, expiry);
  let total = 0;
  for (const req of requests) {
    if (req.end_date < `${year}-01-01` || req.start_date > cutoff) continue;
    const start = req.start_date > `${year}-01-01` ? req.start_date : `${year}-01-01`;
    const end = req.end_date < cutoff ? req.end_date : cutoff;
    if (start <= end) total += businessDaysBetween(start, end);
  }
  return total;
}

export function countMandatoryDaysBeforeExpiry(
  year: number,
  companyHolidays: CompanyHolidayRow[],
  bridgeDays: BridgeDayRow[],
  expiry: LeaveCarryExpiry,
): number {
  const cutoff = expiryIsoInYear(year, expiry);
  const all = collectMandatoryLeaveDates(year, companyHolidays, bridgeDays);
  let count = 0;
  for (const d of all) {
    if (d <= cutoff) count += 1;
  }
  return count;
}

/**
 * Verbrauch des Resturlaubs bis Stichtag (Urlaub + Betrieb/Brücke zählen mit).
 * Der Resturlaub wird zuerst „verbraucht“, bis er aufgebraucht ist.
 */
export function computeCarryUsageBeforeExpiry(
  carriedOver: number,
  urlaubDaysBeforeExpiry: number,
  mandatoryDaysBeforeExpiry: number,
): number {
  const demand = urlaubDaysBeforeExpiry + mandatoryDaysBeforeExpiry;
  return Math.min(carriedOver, demand);
}

export function computeEffectiveCarriedOver(input: {
  carriedOver: number;
  year: number;
  expiry: LeaveCarryExpiry | null;
  urlaubDaysBeforeExpiry: number;
  mandatoryDaysBeforeExpiry: number;
  today?: string;
}): {
  effectiveCarriedOver: number;
  forfeitedCarry: number;
  carryExpiresOn: string | null;
  beforeExpiry: boolean;
} {
  const today = input.today ?? todayIsoInBerlin();
  const carry = Math.max(0, Number(input.carriedOver) || 0);

  if (!input.expiry || carry === 0) {
    return {
      effectiveCarriedOver: carry,
      forfeitedCarry: 0,
      carryExpiresOn: null,
      beforeExpiry: true,
    };
  }

  const expiresOn = expiryIsoInYear(input.year, input.expiry);
  const beforeExpiry = today <= expiresOn;
  const usage = computeCarryUsageBeforeExpiry(
    carry,
    input.urlaubDaysBeforeExpiry,
    input.mandatoryDaysBeforeExpiry,
  );

  if (beforeExpiry) {
    return {
      effectiveCarriedOver: carry,
      forfeitedCarry: 0,
      carryExpiresOn: expiresOn,
      beforeExpiry: true,
    };
  }

  const forfeited = Math.max(0, carry - usage);
  return {
    effectiveCarriedOver: 0,
    forfeitedCarry: forfeited,
    carryExpiresOn: expiresOn,
    beforeExpiry: false,
  };
}

export function automaticCarryFromPreviousRemaining(previousRemaining: number): number {
  return Math.max(0, Math.round(previousRemaining * 2) / 2);
}

export function parseHalfDayField(raw: FormDataEntryValue | null, fallback = 0): number {
  if (raw === null || raw === '') return fallback;
  const n = Number(String(raw).replace(',', '.'));
  if (Number.isNaN(n) || n < 0) throw new Error('Ungültiger Tageswert.');
  const halfSteps = Math.round(n * 2);
  if (Math.abs(halfSteps / 2 - n) > 0.001) {
    throw new Error('Nur halbe Tage (0,5) erlaubt.');
  }
  return halfSteps / 2;
}
