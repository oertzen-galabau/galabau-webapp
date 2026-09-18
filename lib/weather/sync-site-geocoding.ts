import type { SupabaseClient } from '@supabase/supabase-js';
import { isPlausibleGermanCoordinates } from '@/lib/weather/coordinates';
import { geocodeAddress } from '@/lib/weather/geocode';

/** Aktualisiert lat/lng einer Baustelle anhand der Adresse (best effort). */
export async function syncSiteGeocoding(
  supabase: SupabaseClient,
  siteId: string,
  tenantId: string,
  address: string | null,
) {
  const trimmed = address?.trim() ?? '';

  if (!trimmed) {
    const { error } = await supabase
      .from('sites')
      .update({
        latitude: null,
        longitude: null,
        geocoded_at: null,
      })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);

    if (error) console.warn('[geocode] Koordinaten löschen fehlgeschlagen', error.message);
    return;
  }

  const coords = await geocodeAddress(trimmed);
  if (!coords || !isPlausibleGermanCoordinates(coords.latitude, coords.longitude)) {
    console.warn(`[geocode] Kein valider Treffer für Baustelle ${siteId}`);
    await supabase
      .from('sites')
      .update({
        latitude: null,
        longitude: null,
        geocoded_at: null,
      })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);
    return;
  }

  const { error } = await supabase
    .from('sites')
    .update({
      latitude: coords.latitude,
      longitude: coords.longitude,
      geocoded_at: new Date().toISOString(),
    })
    .eq('id', siteId)
    .eq('tenant_id', tenantId);

  if (error) console.warn('[geocode] Koordinaten speichern fehlgeschlagen', error.message);
}
