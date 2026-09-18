type BadWeatherEntryFields = {
  bad_weather_claimed?: boolean | null;
  bad_weather_confirmed?: boolean | null;
};

/** Vorschau bei Freigabe: Meldung des Mitarbeiters oder Vorarbeiter-Markierung. */
export function isBadWeatherForPreview(
  entry: BadWeatherEntryFields,
  tenantDayMarked: boolean,
): boolean {
  if (tenantDayMarked) return true;
  return entry.bad_weather_claimed === true;
}

/** Finale Buchung: nur nach bestätigter Freigabe oder Vorarbeiter-Markierung. */
export function isBadWeatherForBooking(
  entry: BadWeatherEntryFields,
  tenantDayMarked: boolean,
): boolean {
  if (tenantDayMarked) return true;
  return entry.bad_weather_confirmed === true;
}
