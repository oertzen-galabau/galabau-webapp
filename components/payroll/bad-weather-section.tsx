'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markBadWeatherDay, unmarkBadWeatherDay } from '@/lib/actions/payroll';

type Props = {
  markedDates: string[];
  canMark: boolean;
};

export function BadWeatherSection({ markedDates, canMark }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canMark) return null;

  const today = new Date().toISOString().slice(0, 10);
  const isTodayMarked = markedDates.includes(today);

  function toggleToday() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('work_date', today);
      if (isTodayMarked) {
        await unmarkBadWeatherDay(formData);
      } else {
        await markBadWeatherDay(formData);
      }
      router.refresh();
    });
  }

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>Schlechtwetter (KUG)</h2>
      <p className="muted">
        Mitarbeiter melden Schlechtwetter beim Feierabend; das Büro bestätigt bei der Freigabe.
        Vorarbeiter können zusätzlich ganze Tage markieren (Buchung 8110, Dez.–März, ab 1 Std.).
      </p>
      <div className="inline-actions">
        <button
          type="button"
          className={isTodayMarked ? 'primary-button primary-button--compact' : 'text-button'}
          disabled={pending}
          onClick={toggleToday}
        >
          {isTodayMarked ? 'Heute: Schlechtwetter ✓' : 'Heute als Schlechtwetter markieren'}
        </button>
      </div>
      {markedDates.length > 0 && (
        <p className="muted" style={{ marginTop: 8 }}>
          Markiert: {markedDates.slice(0, 10).join(', ')}
          {markedDates.length > 10 ? ` (+${markedDates.length - 10})` : ''}
        </p>
      )}
    </section>
  );
}
