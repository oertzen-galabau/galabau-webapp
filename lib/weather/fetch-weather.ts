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

/** Holt aktuelles Wetter + 5-Tage-Vorhersage von Open-Meteo (30 Min Cache). */
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
    url.searchParams.set('forecast_days', '5');

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
