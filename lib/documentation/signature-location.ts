export const SIGNATURE_GEO_TIMEOUT_MS = 10000;

export function requestSignaturePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation nicht verfügbar'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: SIGNATURE_GEO_TIMEOUT_MS,
      maximumAge: 0,
    });
  });
}

export async function resolveSignatureLocationLabel(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { location?: string | null };
    return data.location ?? null;
  } catch {
    return null;
  }
}

export function formatSignatureAuditLine(
  signedAt: string,
  locationLabel: string | null,
  latitude: number,
  longitude: number,
): string {
  const date = new Date(signedAt);
  const when = Number.isNaN(date.getTime())
    ? signedAt
    : date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
  const where = locationLabel?.trim() || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return `${when} · ${where}`;
}
