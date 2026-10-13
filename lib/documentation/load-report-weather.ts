import { formatReportWeather } from '@/lib/weather/format-report-weather';

export type ReportWeatherSite = {
  id: string;
  address?: string | null;
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
};

export type ReportWeatherResult =
  | { ok: true; weatherText: string; locationLabel?: string }
  | { ok: false; reason: 'no_site' | 'unavailable' | 'out_of_range' | 'geolocation_denied' };

type SiteWeatherApiResponse = {
  needsGeolocation?: boolean;
  weatherText?: string;
  temperature?: number;
  label?: string;
  location?: string | null;
  error?: string;
  outOfRange?: boolean;
};

type CoordsWeatherApiResponse = {
  weatherText?: string;
  temperature?: number;
  label?: string;
  location?: string | null;
  error?: string;
  outOfRange?: boolean;
};

async function fetchWeatherByCoords(lat: number, lng: number, date: string) {
  const response = await fetch(
    `/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&date=${encodeURIComponent(date)}`,
  );
  if (!response.ok) return null;
  return (await response.json()) as CoordsWeatherApiResponse;
}

function requestDevicePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation nicht verfügbar'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10 * 60 * 1000,
    });
  });
}

export async function loadReportWeatherForSite(
  site: ReportWeatherSite,
  logDate: string,
): Promise<ReportWeatherResult> {
  const response = await fetch(
    `/api/weather/site?siteId=${encodeURIComponent(site.id)}&date=${encodeURIComponent(logDate)}`,
  );

  if (response.status === 403 || response.status === 404) {
    return { ok: false, reason: 'unavailable' };
  }

  const data = (await response.json()) as SiteWeatherApiResponse;

  if (data.outOfRange) {
    return { ok: false, reason: 'out_of_range' };
  }

  if (response.ok && data.weatherText) {
    return { ok: true, weatherText: data.weatherText, locationLabel: data.location ?? undefined };
  }

  if (response.ok && data.needsGeolocation) {
    return loadReportWeatherByGeolocation(logDate);
  }

  if (!response.ok) {
    return { ok: false, reason: 'unavailable' };
  }

  if (data.temperature != null && data.label) {
    return {
      ok: true,
      weatherText: data.weatherText ?? formatReportWeather(data.temperature, data.label),
      locationLabel: data.location ?? undefined,
    };
  }

  return { ok: false, reason: 'unavailable' };
}

export async function loadReportWeatherByGeolocation(logDate: string): Promise<ReportWeatherResult> {
  if (!window.isSecureContext) {
    return { ok: false, reason: 'geolocation_denied' };
  }

  try {
    const position = await requestDevicePosition();
    const result = await fetchWeatherByCoords(
      position.coords.latitude,
      position.coords.longitude,
      logDate,
    );
    if (!result) return { ok: false, reason: 'unavailable' };
    if (result.outOfRange) return { ok: false, reason: 'out_of_range' };

    const weatherText =
      result.weatherText ??
      (result.temperature != null && result.label
        ? formatReportWeather(result.temperature, result.label)
        : null);

    if (!weatherText) return { ok: false, reason: 'unavailable' };

    const locationLabel = result.location
      ? `Aktueller Standort (${result.location})`
      : 'Aktueller Standort';

    return { ok: true, weatherText, locationLabel };
  } catch {
    return { ok: false, reason: 'geolocation_denied' };
  }
}
