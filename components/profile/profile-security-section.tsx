'use client';

import { useActionState } from 'react';
import {
  changeOwnEmail,
  changeOwnPassword,
  type ProfileActionResult,
} from '@/lib/actions/profile';

type Props = {
  email: string;
  canChangeEmail: boolean;
  canChangePassword: boolean;
};

const initialState: ProfileActionResult | null = null;

function ActionFeedback({ state }: { state: ProfileActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return <p className="form-feedback form-feedback--success">{state.message}</p>;
  }
  return <p className="form-feedback form-feedback--error">{state.error}</p>;
}

export function ProfileSecuritySection({ email, canChangeEmail, canChangePassword }: Props) {
  const [emailState, emailAction, emailPending] = useActionState(changeOwnEmail, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeOwnPassword, initialState);

  return (
    <section className="panel form-panel employee-section">
      <h2>Sicherheit</h2>
      <p className="muted">
        E-Mail und Passwort können nur nach Bestätigung mit Ihrem aktuellen Passwort geändert werden.
      </p>

      <div className="profile-security-block">
        <h3>E-Mail-Adresse</h3>
        <p className="muted">Aktuelle E-Mail: <strong>{email}</strong></p>
        {canChangeEmail ? (
          <form action={emailAction} className="input-form">
            <div className="input-form-core">
              <label>Neue E-Mail
                <input name="new_email" type="email" required autoComplete="email" />
              </label>
              <label>Aktuelles Passwort
                <input name="current_password" type="password" required autoComplete="current-password" />
              </label>
            </div>
            <ActionFeedback state={emailState} />
            <div className="input-form-actions">
              <button
                type="submit"
                className="primary-button primary-button--compact"
                disabled={emailPending}
              >
                {emailPending ? 'Wird gespeichert…' : 'E-Mail ändern'}
              </button>
            </div>
          </form>
        ) : (
          <p className="muted">Keine Berechtigung zum Ändern der E-Mail.</p>
        )}
      </div>

      <div className="profile-security-block">
        <h3>Passwort</h3>
        {canChangePassword ? (
          <form action={passwordAction} className="input-form">
            <div className="input-form-core">
              <label>Aktuelles Passwort
                <input name="current_password" type="password" required autoComplete="current-password" />
              </label>
              <label>Neues Passwort
                <input name="new_password" type="password" required minLength={8} autoComplete="new-password" />
              </label>
              <label>Neues Passwort bestätigen
                <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
              </label>
            </div>
            <ActionFeedback state={passwordState} />
            <div className="input-form-actions">
              <button
                type="submit"
                className="primary-button primary-button--compact"
                disabled={passwordPending}
              >
                {passwordPending ? 'Wird gespeichert…' : 'Passwort ändern'}
              </button>
            </div>
          </form>
        ) : (
          <p className="muted">Keine Berechtigung zum Ändern des Passworts.</p>
        )}
      </div>
    </section>
  );
}
