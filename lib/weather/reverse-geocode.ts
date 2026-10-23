type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
};

type NominatimResponse = {
  address?: NominatimAddress;
};

/** Koordinaten → Ortsname (Reverse Geocoding via Nominatim, best effort). */
export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'json');
    url.searchParams.set('accept-language', 'de');
    url.searchParams.set('zoom', '10');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'BauDiggie-Baustellenmanagement/1.0 (contact@baudiggi.de)' },
      next: { revalidate: 86400 },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as NominatimResponse;
    const address = data.address;
    if (!address) return null;

    return (
      address.city
      ?? address.town
      ?? address.village
      ?? address.municipality
      ?? address.county
      ?? null
    );
  } catch {
    return null;
  }
}
