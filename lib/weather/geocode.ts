import { isPlausibleGermanCoordinates } from '@/lib/weather/coordinates';

export type GeocodedLocation = {
  latitude: number;
  longitude: number;
};

type GeocodingApiResponse = {
  results?: Array<{
    latitude: number;
    longitude: number;
    country_code?: string;
  }>;
};

function isGeocodableAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.length < 5) return false;
  if (/\d{5}/.test(trimmed) || trimmed.includes(',')) return true;
  return trimmed.split(/\s+/).length >= 2 && trimmed.length >= 8;
}

function extractGermanCityQuery(address: string): string | null {
  const plzCity = address.match(/\b(\d{5})\s+([A-Za-zäöüÄÖÜß\-]+(?:\s+[A-Za-zäöüÄÖÜß\-]+)?)/);
  if (plzCity) return `${plzCity[2]}`.trim();

  const afterComma = address.split(',').pop()?.trim();
  if (afterComma && afterComma.length >= 3) return afterComma;

  return null;
}

async function searchGeocode(query: string): Promise<GeocodedLocation | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'de');
  url.searchParams.set('countryCode', 'DE');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), {
    next: { revalidate: 86400 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as GeocodingApiResponse;
  const result = data.results?.[0];
  if (result?.latitude == null || result?.longitude == null) return null;

  if (result.country_code && result.country_code !== 'DE') return null;
  if (!isPlausibleGermanCoordinates(result.latitude, result.longitude)) return null;

  return {
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

/** Geocodiert eine Freitext-Adresse über Open-Meteo (best effort, wirft nie). */
export async function geocodeAddress(address: string): Promise<GeocodedLocation | null> {
  const trimmed = address.trim();
  if (!isGeocodableAddress(trimmed)) return null;

  try {
    const fullMatch = await searchGeocode(trimmed);
    if (fullMatch) return fullMatch;

    const cityQuery = extractGermanCityQuery(trimmed);
    if (cityQuery && cityQuery !== trimmed) {
      return await searchGeocode(cityQuery);
    }

    return null;
  } catch (error) {
    console.warn('[geocode] fehlgeschlagen', error);
    return null;
  }
}
