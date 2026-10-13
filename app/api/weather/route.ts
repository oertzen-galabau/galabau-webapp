import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchSiteWeather, isDateWithinWeatherWindow } from '@/lib/weather/fetch-weather';
import { pickWeatherForDate, reportWeatherTodayDate } from '@/lib/weather/format-report-weather';
import { reverseGeocodeLocation } from '@/lib/weather/reverse-geocode';

function parseCoordinate(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function isValidLatitude(lat: number) {
  return lat >= -90 && lat <= 90;
}

function isValidLongitude(lng: number) {
  return lng >= -180 && lng <= 180;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseCoordinate(searchParams.get('lat'));
  const lng = parseCoordinate(searchParams.get('lng'));
  const targetDate = searchParams.get('date')?.trim() || reportWeatherTodayDate();

  if (lat == null || lng == null || !isValidLatitude(lat) || !isValidLongitude(lng)) {
    return NextResponse.json({ error: 'Ungültige Koordinaten' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 });
  }

  if (!isDateWithinWeatherWindow(targetDate)) {
    return NextResponse.json({ outOfRange: true, weatherText: null });
  }

  const [weather, location] = await Promise.all([
    fetchSiteWeather(lat, lng),
    reverseGeocodeLocation(lat, lng),
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
