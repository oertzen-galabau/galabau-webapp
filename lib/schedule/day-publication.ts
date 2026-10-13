/** Woche gilt als veröffentlicht, wenn jeder Tag mit Einsätzen veröffentlicht ist. */
export function isWeekFullyPublished(
  daysWithEntries: string[],
  publishedByDay: Record<string, boolean>,
): boolean {
  if (daysWithEntries.length === 0) return true;
  return daysWithEntries.every((d) => publishedByDay[d]);
}
