'use client';

import { useActionState } from 'react';
import {
  completeForcedPasswordChange,
  type InvitationActionResult,
} from '@/lib/actions/employee-invitation';
import { AuthBrandHeader } from '@/components/auth/auth-brand-header';

const initialState: InvitationActionResult | null = null;

function ActionFeedback({ state }: { state: InvitationActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return <p className="form-success">{state.message}</p>;
  }
  return <p className="form-error">{state.error}</p>;
}

export function ForcedPasswordChangeForm() {
  const [state, action, pending] = useActionState(completeForcedPasswordChange, initialState);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthBrandHeader />
        <h1 style={{ marginTop: 0 }}>Passwort festlegen</h1>
        <p className="muted">
          Für Ihr Konto ist noch ein persönliches Passwort erforderlich. Bitte legen Sie es jetzt fest.
        </p>
        <form action={action} className="auth-form">
          <label className="auth-field">
            Neues Passwort
            <input name="new_password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <label className="auth-field">
            Passwort bestätigen
            <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <ActionFeedback state={state} />
          <div className="auth-form-actions">
            <button type="submit" className="primary-button" disabled={pending}>
              {pending ? 'Wird gespeichert…' : 'Passwort speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
