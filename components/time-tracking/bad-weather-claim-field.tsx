'use client';

import { useEffect, useRef, useState } from 'react';
import { isBadWeatherSeason, formatBadWeatherSeasonLabel } from '@/lib/payroll/constants';

type Props = {
  seasonStart: string;
  seasonEnd: string;
  defaultClaimed?: boolean;
  defaultWorkDate?: string;
};

export function BadWeatherClaimField({
  seasonStart,
  seasonEnd,
  defaultClaimed = false,
  defaultWorkDate,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const containerRef = useRef<HTMLDivElement>(null);
  const [workDate, setWorkDate] = useState(defaultWorkDate ?? today);
  const [claimed, setClaimed] = useState(defaultClaimed);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const dateInput = container.closest('form')?.querySelector<HTMLInputElement>('input[name="work_date"]');
    if (!dateInput) return;

    const syncDate = () => {
      const next = dateInput.value || today;
      setWorkDate(next);
      if (!isBadWeatherSeason(next, seasonStart, seasonEnd)) {
        setClaimed(false);
      }
    };
    syncDate();
    dateInput.addEventListener('change', syncDate);
    return () => dateInput.removeEventListener('change', syncDate);
  }, [today, seasonStart, seasonEnd]);

  const inSeason = isBadWeatherSeason(workDate, seasonStart, seasonEnd);
  const seasonLabel = formatBadWeatherSeasonLabel(seasonStart, seasonEnd);

  if (!inSeason) return null;

  return (
    <div ref={containerRef} className="input-form-span-full">
      <label className="input-form-checkbox">
        <input
          type="checkbox"
          name="bad_weather_claimed"
          checked={claimed}
          onChange={(e) => setClaimed(e.target.checked)}
        />
        Schlechtwetter (KUG) — am Standort
      </label>
      <p className="muted" style={{ marginTop: 4 }}>
        Saison {seasonLabel}. Buchung 8110 wird nach Freigabe durch das Büro bestätigt.
      </p>
    </div>
  );
}
