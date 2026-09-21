import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchSiteWeather } from '@/lib/weather/fetch-weather';
import { formatReportWeather } from '@/lib/weather/format-report-weather';
import { formatSiteAddress } from '@/lib/sites/format-address';
import { geocodeAddress } from '@/lib/weather/geocode';
import { reverseGeocodeLocation } from '@/lib/weather/reverse-geocode';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const siteId = new URL(request.url).searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'Baustelle fehlt' }, { status: 400 });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, street, zip_code, city, address, latitude, longitude')
    .eq('id', siteId)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: 'Baustelle nicht gefunden' }, { status: 404 });
  }

  const formattedAddress = formatSiteAddress(site);
  if (!formattedAddress) {
    return NextResponse.json({ needsGeolocation: true });
  }

  let latitude = site.latitude;
  let longitude = site.longitude;

  if (latitude == null || longitude == null) {
    const geocoded = await geocodeAddress(formattedAddress);
    if (!geocoded) {
      return NextResponse.json({ error: 'Standort nicht ermittelbar' }, { status: 422 });
    }
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
  }

  const [weather, location] = await Promise.all([
    fetchSiteWeather(latitude, longitude),
    reverseGeocodeLocation(latitude, longitude),
  ]);

  if (!weather) {
    return NextResponse.json({ error: 'Wetterdaten nicht verfügbar' }, { status: 502 });
  }

  return NextResponse.json({
    temperature: weather.current.temperature,
    label: weather.current.label,
    iconKind: weather.current.iconKind,
    location,
    weatherText: formatReportWeather(weather.current.temperature, weather.current.label),
  });
}
