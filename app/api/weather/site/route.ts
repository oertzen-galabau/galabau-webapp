import { NextResponse } from 'next/server';
import { getActionContext } from '@/lib/auth/session';
import { userCanAccessSite } from '@/lib/sites/access';
import { createClient } from '@/lib/supabase/server';
import { fetchSiteWeather, isDateWithinWeatherWindow } from '@/lib/weather/fetch-weather';
import { pickWeatherForDate, reportWeatherTodayDate } from '@/lib/weather/format-report-weather';
import { formatSiteAddress } from '@/lib/sites/format-address';
import { geocodeAddress } from '@/lib/weather/geocode';
import { reverseGeocodeLocation } from '@/lib/weather/reverse-geocode';

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const targetDate = searchParams.get('date')?.trim() || reportWeatherTodayDate();
  if (!siteId) {
    return NextResponse.json({ error: 'Baustelle fehlt' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 });
  }

  if (!isDateWithinWeatherWindow(targetDate)) {
    return NextResponse.json({ outOfRange: true, weatherText: null });
  }

  if (!(await userCanAccessSite(supabase, ctx, siteId))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, street, zip_code, city, address, latitude, longitude')
    .eq('id', siteId)
    .eq('tenant_id', ctx.tenantId)
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

  const picked = pickWeatherForDate(weather, targetDate);
  if (!picked) {
    return NextResponse.json({ outOfRange: true, weatherText: null });
  }

  return NextResponse.json({
    temperature: weather.current.temperature,
    label: weather.current.label,
    iconKind: picked.iconKind,
    location,
    weatherText: picked.weatherText,
    targetDate,
  });
}
