import { getWeatherInfo } from '@/lib/weather/weather-codes';

export type CurrentWeather = {
  temperature: number;
  windspeed: number;
  weathercode: number;
  label: string;
  iconKind: ReturnType<typeof getWeatherInfo>['iconKind'];
};

export type DailyForecast = {
  date: string;
  tempMin: number;
  tempMax: number;
  precipitation: number;
  weathercode: number;
  label: string;
  iconKind: ReturnType<typeof getWeatherInfo>['iconKind'];
};

export type SiteWeather = {
  current: CurrentWeather;
  daily: DailyForecast[];
};

type ForecastApiResponse = {
  current_weather?: {
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
  };
};

const PAST_DAYS = 7;
const FORECAST_DAYS = 16;

/** Holt aktuelles Wetter + Tagesdaten von Open-Meteo (30 Min Cache). */
export async function fetchSiteWeather(
  latitude: number,
  longitude: number,
): Promise<SiteWeather | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current_weather', 'true');
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('past_days', String(PAST_DAYS));
    url.searchParams.set('forecast_days', String(FORECAST_DAYS));

    const response = await fetch(url.toString(), {
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      console.warn('[weather] API-Fehler', response.status);
      return null;
    }

    const data = (await response.json()) as ForecastApiResponse;
    const current = data.current_weather;
    const daily = data.daily;

    if (!current || !daily?.time?.length) return null;

    const currentInfo = getWeatherInfo(current.weathercode);

    return {
      current: {
        temperature: current.temperature,
        windspeed: current.windspeed,
        weathercode: current.weathercode,
        label: currentInfo.label,
        iconKind: currentInfo.iconKind,
      },
      daily: daily.time.map((date, index) => {
        const code = daily.weathercode[index] ?? 0;
        const info = getWeatherInfo(code);
        return {
          date,
          tempMin: daily.temperature_2m_min[index] ?? 0,
          tempMax: daily.temperature_2m_max[index] ?? 0,
          precipitation: daily.precipitation_sum[index] ?? 0,
          weathercode: code,
          label: info.label,
          iconKind: info.iconKind,
        };
      }),
    };
  } catch (error) {
    console.warn('[weather] fehlgeschlagen', error);
    return null;
  }
}

export function isDateWithinWeatherWindow(targetDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${targetDate}T12:00:00`);
  if (Number.isNaN(target.getTime())) return false;
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= -PAST_DAYS && diffDays < FORECAST_DAYS;
}
