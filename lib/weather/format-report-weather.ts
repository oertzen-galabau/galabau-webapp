/** Kurztext fürs Rapport-Wetterfeld, z. B. „18°C, Bewölkt“. */
export function formatReportWeather(temperature: number, label: string): string {
  return `${Math.round(temperature)}°C, ${label}`;
}
