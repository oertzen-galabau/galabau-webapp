import { hasSiteAddress, type SiteAddressParts } from '@/lib/sites/format-address';
import type { Site } from '@/lib/types/database';
import { fetchSiteWeather } from '@/lib/weather/fetch-weather';
import { WeatherIcon } from '@/components/sites/weather-icon';

type Props = {
  site: Pick<Site, 'latitude' | 'longitude'> & SiteAddressParts;
};

function formatDayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTemperature(value: number) {
  return `${Math.round(value)}°`;
}

export async function SiteWeatherSection({ site }: Props) {
  const hasCoordinates = site.latitude != null && site.longitude != null;

  if (!hasSiteAddress(site)) {
    return (
      <section className="site-detail-section">
        <h2>Wetter</h2>
        <p className="muted">Keine Adresse hinterlegt — Wetteranzeige nicht verfügbar.</p>
      </section>
    );
  }

  if (!hasCoordinates) {
    return (
      <section className="site-detail-section">
        <h2>Wetter</h2>
        <p className="muted">
          Standort wird beim nächsten Speichern der Adresse ermittelt.
        </p>
      </section>
    );
  }

  const weather = await fetchSiteWeather(site.latitude!, site.longitude!);

  if (!weather) {
    return (
      <section className="site-detail-section">
        <h2>Wetter</h2>
        <p className="muted">Wetterdaten sind derzeit nicht verfügbar.</p>
      </section>
    );
  }

  return (
    <section className="site-detail-section">
      <h2>Wetter am Standort</h2>

      <div className="weather-card">
        <WeatherIcon kind={weather.current.iconKind} className="weather-icon" aria-hidden />
        <div>
          <span>{weather.current.label}</span>
          <strong>{formatTemperature(weather.current.temperature)}</strong>
          <small>Wind {Math.round(weather.current.windspeed)} km/h</small>
        </div>
      </div>

      <div className="site-weather-forecast">
        {weather.daily.map((day) => (
            <div key={day.date} className="site-weather-forecast-day">
              <span className="site-weather-forecast-date">{formatDayLabel(day.date)}</span>
              <WeatherIcon kind={day.iconKind} size={20} aria-hidden />
              <span className="site-weather-forecast-temps">
                {formatTemperature(day.tempMax)} / {formatTemperature(day.tempMin)}
              </span>
              {day.precipitation > 0 ? (
                <small className="site-weather-forecast-rain">{day.precipitation.toFixed(1)} mm</small>
              ) : null}
            </div>
        ))}
      </div>
    </section>
  );
}
