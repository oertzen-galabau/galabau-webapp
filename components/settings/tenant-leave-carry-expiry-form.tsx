import { updateTenantLeaveCarryExpiry } from '@/lib/actions/admin';

type Props = {
  expireMonth: number | null;
  expireDay: number | null;
};

export function TenantLeaveCarryExpiryForm({ expireMonth, expireDay }: Props) {
  return (
    <section className="panel form-panel" style={{ marginTop: 16 }}>
      <h2>Resturlaub Vorjahr</h2>
      <p className="muted">
        Optionaler Stichtag, bis wann übertragener Resturlaub genutzt sein muss. Leer lassen = kein
        Verfall.
      </p>
      <form action={updateTenantLeaveCarryExpiry} className="input-form">
        <div className="input-form-core input-form-core--split">
          <label>
            Monat (1–12)
            <input
              type="number"
              name="leave_carry_expire_month"
              min={1}
              max={12}
              placeholder="z. B. 3"
              defaultValue={expireMonth ?? ''}
            />
          </label>
          <label>
            Tag (1–31)
            <input
              type="number"
              name="leave_carry_expire_day"
              min={1}
              max={31}
              placeholder="z. B. 31"
              defaultValue={expireDay ?? ''}
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
