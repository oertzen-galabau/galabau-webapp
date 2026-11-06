/**
 * Woche gilt als veröffentlicht, wenn jeder relevante Tag mit Einsätzen veröffentlicht ist.
 * Vergangene Tage (vor `today`) zählen nicht – dort ist „Woche veröffentlichen“ ohnehin ausgesetzt.
 */
export function isWeekFullyPublished(
  daysWithEntries: string[],
  publishedByDay: Record<string, boolean>,
  today: string,
): boolean {
  const relevant = daysWithEntries.filter((d) => d >= today);
  if (relevant.length === 0) return true;
  return relevant.every((d) => publishedByDay[d]);
}
