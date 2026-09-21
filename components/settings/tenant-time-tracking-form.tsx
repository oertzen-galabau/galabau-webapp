'use client';

import type { TenantTimeTrackingRules } from '@/lib/types/database';
import { saveTenantTimeTrackingRules } from '@/lib/actions/time-tracking-settings';

type Props = {
  rules: TenantTimeTrackingRules;
};

export function TenantTimeTrackingForm({ rules }: Props) {
  return (
    <section className="panel form-panel">
      <h2>Zeiterfassung & Pausen</h2>
      <p className="muted">
        Legt fest, ab welcher Arbeitsdauer Frühstück und Mittag erwartet werden und wann ein Grund
        für fehlende Pausen verlangt wird.
      </p>

      <form action={saveTenantTimeTrackingRules} className="input-form">
        <details className="input-form-extra" open>
          <summary>Frühstück</summary>
          <div className="input-form-extra-grid">
            <label className="input-form-checkbox">
              <input type="checkbox" name="breakfast_enabled" defaultChecked={rules.breakfast_enabled} />
              Frühstückspause erwarten
            </label>
            <label>
              Erwartet ab Arbeitsdauer (Min.)
              <input
                type="number"
                name="breakfast_min_work_minutes"
                min={0}
                defaultValue={rules.breakfast_min_work_minutes}
              />
            </label>
            <label>
              Soll-Dauer (Min.)
              <input
                type="number"
                name="breakfast_expected_minutes"
                min={0}
                defaultValue={rules.breakfast_expected_minutes}
              />
            </label>
            <label>
              Zeitfenster von
              <input
                type="time"
                name="breakfast_window_start"
                defaultValue={rules.breakfast_window_start.slice(0, 5)}
              />
            </label>
            <label>
              Zeitfenster bis
              <input
                type="time"
                name="breakfast_window_end"
                defaultValue={rules.breakfast_window_end.slice(0, 5)}
              />
            </label>
          </div>
        </details>

        <details className="input-form-extra" open>
          <summary>Mittag</summary>
          <div className="input-form-extra-grid">
            <label className="input-form-checkbox">
              <input type="checkbox" name="lunch_enabled" defaultChecked={rules.lunch_enabled} />
              Mittagspause erwarten
            </label>
            <label>
              Erwartet ab Arbeitsdauer (Min.)
              <input
                type="number"
                name="lunch_min_work_minutes"
                min={0}
                defaultValue={rules.lunch_min_work_minutes}
              />
            </label>
            <label>
              Soll-Dauer (Min.)
              <input
                type="number"
                name="lunch_expected_minutes"
                min={0}
                defaultValue={rules.lunch_expected_minutes}
              />
            </label>
            <label>
              Zeitfenster von
              <input
                type="time"
                name="lunch_window_start"
                defaultValue={rules.lunch_window_start.slice(0, 5)}
              />
            </label>
            <label>
              Zeitfenster bis
              <input
                type="time"
                name="lunch_window_end"
                defaultValue={rules.lunch_window_end.slice(0, 5)}
              />
            </label>
          </div>
        </details>

        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">
            Regeln speichern
          </button>
        </div>
      </form>
    </section>
  );
}
