import { updateTenantGpsEnabled } from '@/lib/actions/admin';

type Props = {
  gpsEnabled: boolean;
};

export function TenantGpsForm({ gpsEnabled }: Props) {
  return (
    <section className="panel form-panel">
      <h2>GPS & Standort</h2>
      <p className="muted">
        Steuert, ob die App den Gerätestandort verwenden darf: Wetter im Header, Wetter-Vorlage in der
        Dokumentation (ohne Baustellenadresse) und Standort bei Unterschriften. Ist GPS deaktiviert,
        wird keine Ortung abgefragt und keine Position gespeichert.
      </p>
      <form action={updateTenantGpsEnabled} className="input-form">
        <div className="input-form-core">
          <label className="input-form-checkbox">
            <input type="checkbox" name="gps_enabled" defaultChecked={gpsEnabled} />
            GPS / Standort aktiv
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
