export const BOOKING_CODES = {
  NORMAL: '1000',
  LKW: '1001',
  SCHOOL: '1002',
  DRIVER_FREE: '1004',
  DRIVER_TAX: '1005',
  TRAVEL_ALLOWANCE_FREE: '1006',
  TRAVEL_ALLOWANCE_TAX: '1007',
  SICK: '1650',
  DRIVER_TRAVEL_TIME: '2013',
  VACATION: '8057',
  BAD_WEATHER: '8110',
} as const;

export const NET_WORK_TAX_FREE_THRESHOLD_MINUTES = 420; // 7h
export const TRAVEL_TIME_THRESHOLD_MINUTES = 30;
export const BAD_WEATHER_MIN_WORK_MINUTES = 60;
export const DRIVER_ALLOWANCE_EUR = 6;
export const TRAVEL_ALLOWANCE_EUR = 6;

export const LEAVE_BOOKING_CODE: Record<string, string> = {
  urlaub: BOOKING_CODES.VACATION,
  krankheit: BOOKING_CODES.SICK,
  schule: BOOKING_CODES.SCHOOL,
};

export const DEFAULT_BOOKING_LABELS: Record<string, string> = {
  '1000': 'Normalstunden',
  '1001': 'LKW-Std',
  '1002': 'Schule',
  '1004': 'Fahrer-Zuschlag steuerfrei',
  '1005': 'Fahrer-Zuschlag steuerpflichtig',
  '1006': 'Wegegeld steuerfrei',
  '1007': 'Wegegeld steuerpflichtig',
  '1650': 'Krank',
  '2013': 'Wegezeit Fahrer',
  '8057': 'Urlaub',
  '8110': 'Saison KUG Schlechtwetter',
};

export const DEFAULT_BAD_WEATHER_SEASON_START = '12-01';
export const DEFAULT_BAD_WEATHER_SEASON_END = '03-31';

/** Prüft ob ein Datum (YYYY-MM-DD) in der KUG-Saison liegt (MM-TT, ggf. über Jahreswechsel). */
export function isBadWeatherSeason(
  dateStr: string,
  seasonStart: string = DEFAULT_BAD_WEATHER_SEASON_START,
  seasonEnd: string = DEFAULT_BAD_WEATHER_SEASON_END,
): boolean {
  const md = dateStr.slice(5);
  if (seasonStart <= seasonEnd) {
    return md >= seasonStart && md <= seasonEnd;
  }
  return md >= seasonStart || md <= seasonEnd;
}

export function formatBadWeatherSeasonLabel(seasonStart: string, seasonEnd: string): string {
  const formatPart = (mmdd: string) => {
    const [month, day] = mmdd.split('-');
    return `${day}.${month}.`;
  };
  return `${formatPart(seasonStart)}–${formatPart(seasonEnd)}`;
}

/** ISO weekday: Mo=1 … So=7 */
export function isoWeekday(dateStr: string): number {
  const day = new Date(dateStr).getDay();
  return day === 0 ? 7 : day;
}

export function defaultDayHours(dateStr: string): number {
  const month = new Date(dateStr).getMonth() + 1;
  const weekday = isoWeekday(dateStr);
  if (weekday > 5) return 0;
  if (month === 12 || month === 1) return weekday === 5 ? 6 : 7.5;
  if (month === 2) return weekday === 5 ? 6.5 : 8;
  if (month === 3) return weekday === 5 ? 6.5 : 8.5;
  return 8;
}
