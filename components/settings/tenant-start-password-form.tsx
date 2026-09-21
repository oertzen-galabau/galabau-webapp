'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { updateTenantStartPassword } from '@/lib/actions/admin';

type Props = {
  configured: boolean;
  currentPassword: string | null;
};

export function TenantStartPasswordForm({ configured, currentPassword }: Props) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  return (
    <section className="panel form-panel">
      <h2>Startpasswort</h2>
      <p className="muted">
        Interner Vorgabewert für das Onboarding. Eine Änderung überschreibt keine Passwörter
        bestehender Mitarbeiterkonten.
      </p>

      {configured && currentPassword ? (
        <label>
          Aktuelles Startpasswort
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              readOnly
              aria-readonly
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="input-form-row-action"
              onClick={() => setShowCurrent((value) => !value)}
              aria-label={showCurrent ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
      ) : (
        <p className="muted">Noch kein Startpasswort hinterlegt. Bitte unten festlegen.</p>
      )}

      <form action={updateTenantStartPassword} className="input-form" style={{ marginTop: 16 }}>
        <div className="input-form-core">
          <label>
            {configured ? 'Neues Startpasswort' : 'Startpasswort'}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                name="password"
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mindestens 8 Zeichen"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="input-form-row-action"
                onClick={() => setShowNew((value) => !value)}
                aria-label={showNew ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label>
            Passwort bestätigen
            <input
              name="confirm_password"
              type={showNew ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">
            {configured ? 'Startpasswort ändern' : 'Startpasswort speichern'}
          </button>
        </div>
      </form>
    </section>
  );
}
