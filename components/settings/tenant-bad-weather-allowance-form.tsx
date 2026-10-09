import { updateTenantBadWeatherAllowance } from '@/lib/actions/admin';

type Props = {
  allowanceDays: number;
};

export function TenantBadWeatherAllowanceForm({ allowanceDays }: Props) {
  return (
    <section className="panel form-panel" style={{ marginTop: 16 }}>
      <h2>Schlechtwetter (KUG)</h2>
      <p className="muted">
        Puffer pro Jahr für alle — mindert den Resturlaub immer, auch ohne Buchung.
      </p>
      <form action={updateTenantBadWeatherAllowance} className="input-form">
        <div className="input-form-core">
          <label>
            Schlechtwetter-Tage pro Jahr
            <input
              type="number"
              name="bad_weather_allowance_days"
              min={0}
              max={366}
              step={1}
              defaultValue={allowanceDays}
              required
            />
          </label>
        </div>
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">
            Speichern
          </button>
        </div>
      </form>
    </section>
  );
}
