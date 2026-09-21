'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markBadWeatherDay, unmarkBadWeatherDay } from '@/lib/actions/payroll';

type Props = {
  markedDates: string[];
  suggestedDates?: string[];
};

export function BadWeatherFreigabeControl({ markedDates, suggestedDates = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = suggestedDates[0] ?? today;
  const [workDate, setWorkDate] = useState(defaultDate);

  const isMarked = markedDates.includes(workDate);

  function toggleMark() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('work_date', workDate);
      if (isMarked) {
        await unmarkBadWeatherDay(formData);
      } else {
        await markBadWeatherDay(formData);
      }
      router.refresh();
    });
  }

  return (
    <div className="bad-weather-freigabe-control" style={{ marginBottom: 16 }}>
      <p className="muted" style={{ marginBottom: 8 }}>
        Ganzen Tag als Schlechtwetter markieren (Buchung 8110) — gilt für alle Mitarbeiter an diesem Tag.
      </p>
      <div className="inline-actions">
        <label>
          Datum
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            disabled={pending}
          />
        </label>
        <button
          type="button"
          className={isMarked ? 'primary-button primary-button--compact' : 'text-button'}
          disabled={pending}
          onClick={toggleMark}
        >
          {isMarked ? 'Markierung aufheben' : 'Als Schlechtwetter markieren'}
        </button>
      </div>
      {suggestedDates.length > 1 && (
        <p className="muted" style={{ marginTop: 8 }}>
          Offene Freigaben: {suggestedDates.join(', ')}
        </p>
      )}
    </div>
  );
}
