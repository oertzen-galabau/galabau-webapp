import type { DriverTrip } from '@/lib/types/database';

export const DRIVER_TRIP_VALUES = ['none', 'round_trip', 'outbound', 'return'] as const satisfies readonly DriverTrip[];

export const DRIVER_TRIP_LABELS: Record<DriverTrip, string> = {
  none: 'Kein Fahrer (Beifahrer)',
  round_trip: 'Hin und Zurück',
  outbound: 'Hin',
  return: 'Zurück',
};

export const DRIVER_TRIP_SELECT_OPTIONS = DRIVER_TRIP_VALUES.map((value) => ({
  value,
  label: DRIVER_TRIP_LABELS[value],
}));

export function parseDriverTrip(raw: unknown): DriverTrip {
  if (typeof raw === 'string' && (DRIVER_TRIP_VALUES as readonly string[]).includes(raw)) {
    return raw as DriverTrip;
  }
  return 'none';
}

/** Legacy-Einträge ohne `driver_trip` aus `is_driver` ableiten. */
export function resolveDriverTrip(entry: {
  driver_trip?: DriverTrip | null;
  is_driver?: boolean | null;
}): DriverTrip {
  if (entry.driver_trip && (DRIVER_TRIP_VALUES as readonly string[]).includes(entry.driver_trip)) {
    return entry.driver_trip;
  }
  return entry.is_driver === true ? 'round_trip' : 'none';
}

export function isDriverForPayroll(trip: DriverTrip): boolean {
  return trip !== 'none';
}

export function isDriverFromEntry(entry: {
  driver_trip?: DriverTrip | null;
  is_driver?: boolean | null;
}): boolean {
  return isDriverForPayroll(resolveDriverTrip(entry));
}

/** Faktor für Fahrer-Zuschlag und Wegezeit Fahrer (0 / 0.5 / 1). */
export function driverPayrollFactor(trip: DriverTrip): number {
  if (trip === 'round_trip') return 1;
  if (trip === 'outbound' || trip === 'return') return 0.5;
  return 0;
}

export function driverTripLabel(entry: {
  driver_trip?: DriverTrip | null;
  is_driver?: boolean | null;
}): string {
  return DRIVER_TRIP_LABELS[resolveDriverTrip(entry)];
}

export function isDriverFlagFromTrip(trip: DriverTrip): boolean {
  return isDriverForPayroll(trip);
}
