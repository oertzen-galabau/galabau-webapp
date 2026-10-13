import type { SiteWeather } from '@/lib/weather/fetch-weather';

/** Kurztext fürs Rapport-Wetterfeld, z. B. „18°C, Bewölkt“. */
export function formatReportWeather(temperature: number, label: string): string {
  return `${Math.round(temperature)}°C, ${label}`;
}

/** Tageswert (Min/Max) fürs Rapport-Wetterfeld, z. B. „6–14°C, Regen“. */
export function formatReportWeatherForDay(tempMin: number, tempMax: number, label: string): string {
  const min = Math.round(tempMin);
  const max = Math.round(tempMax);
  if (min === max) {
    return `${min}°C, ${label}`;
  }
  return `${min}–${max}°C, ${label}`;
}

export function reportWeatherTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function pickWeatherForDate(
  weather: SiteWeather,
  targetDate: string,
): { weatherText: string; iconKind: SiteWeather['current']['iconKind'] } | null {
  const today = reportWeatherTodayDate();
  if (targetDate === today) {
    return {
      weatherText: formatReportWeather(weather.current.temperature, weather.current.label),
      iconKind: weather.current.iconKind,
    };
  }

  const day = weather.daily.find((entry) => entry.date === targetDate);
  if (!day) return null;

  return {
    weatherText: formatReportWeatherForDay(day.tempMin, day.tempMax, day.label),
    iconKind: day.iconKind,
  };
}

export function weatherTextForDate(weather: SiteWeather, targetDate: string): string | null {
  return pickWeatherForDate(weather, targetDate)?.weatherText ?? null;
}
