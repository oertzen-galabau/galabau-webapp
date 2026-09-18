'use client';

import { useEffect, useState } from 'react';
import { WeatherIcon } from '@/components/sites/weather-icon';
import type { WeatherIconKind } from '@/lib/weather/weather-codes';

type HeaderWeatherData = {
  temperature: number;
  label: string;
  iconKind: WeatherIconKind;
  location: string | null;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const GEO_TIMEOUT_MS = 10000;

let cachedWeather: HeaderWeatherData | null = null;
let cachedAt = 0;
let cachedCoords: { lat: number; lng: number } | null = null;

function isFreshCache(lat: number, lng: number) {
  if (cachedWeather == null || Date.now() - cachedAt >= CACHE_TTL_MS) return false;
  if (cachedCoords == null) return true;
  return (
    Math.abs(cachedCoords.lat - lat) < 0.05 && Math.abs(cachedCoords.lng - lng) < 0.05
  );
}

async function fetchWeather(lat: number, lng: number): Promise<HeaderWeatherData | null> {
  const response = await fetch(
    `/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
  );
  if (!response.ok) return null;
  return (await response.json()) as HeaderWeatherData;
}

function requestPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation nicht verfügbar'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: GEO_TIMEOUT_MS,
      maximumAge: CACHE_TTL_MS,
    });
  });
}

/** Wetter im Header — ausschließlich vom Gerätestandort (Browser-Geolocation). */
export function HeaderWeather() {
  const [weather, setWeather] = useState<HeaderWeatherData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFromDevice() {
      if (!window.isSecureContext) return;

      try {
        const position = await requestPosition();
        if (cancelled) return;

        const { latitude, longitude } = position.coords;

        if (isFreshCache(latitude, longitude)) {
          setWeather(cachedWeather);
          return;
        }

        const result = await fetchWeather(latitude, longitude);
        if (cancelled || !result) return;

        cachedWeather = result;
        cachedCoords = { lat: latitude, lng: longitude };
        cachedAt = Date.now();
        setWeather(result);
      } catch {
        // Standort verweigert oder nicht verfügbar
      }
    }

    void loadFromDevice();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!weather) return null;

  const locationLabel = weather.location ?? 'Standort';
  const ariaLabel = `${weather.label}, ${Math.round(weather.temperature)} Grad in ${locationLabel}`;

  return (
    <span className="header-weather" title={`${weather.label} · ${locationLabel}`} aria-label={ariaLabel}>
      <WeatherIcon kind={weather.iconKind} size={18} aria-hidden />
      <strong>{Math.round(weather.temperature)}°</strong>
      {weather.location ? (
        <span className="header-weather-location">{weather.location}</span>
      ) : null}
    </span>
  );
}
