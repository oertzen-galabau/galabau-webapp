import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export type WeatherIconKind =
  | 'sun'
  | 'cloud-sun'
  | 'cloud'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'thunder';

export const WEATHER_ICON_MAP: Record<WeatherIconKind, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
};

/** WMO-Wettercode (Open-Meteo) → deutsche Beschreibung + Icon. */
export function getWeatherInfo(code: number): { label: string; iconKind: WeatherIconKind } {
  if (code === 0) return { label: 'Klar', iconKind: 'sun' };
  if (code <= 3) return { label: 'Teilweise bewölkt', iconKind: 'cloud-sun' };
  if (code <= 48) return { label: 'Nebel', iconKind: 'fog' };
  if (code <= 57) return { label: 'Nieselregen', iconKind: 'rain' };
  if (code <= 67) return { label: 'Regen', iconKind: 'rain' };
  if (code <= 77) return { label: 'Schnee', iconKind: 'snow' };
  if (code <= 82) return { label: 'Schauer', iconKind: 'rain' };
  if (code <= 86) return { label: 'Schneeschauer', iconKind: 'snow' };
  if (code >= 95) return { label: 'Gewitter', iconKind: 'thunder' };
  return { label: 'Bewölkt', iconKind: 'cloud' };
}

export function getWeatherIcon(iconKind: WeatherIconKind): LucideIcon {
  return WEATHER_ICON_MAP[iconKind];
}
