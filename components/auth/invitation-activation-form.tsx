'use client';

import { useActionState } from 'react';
import {
  activateInvitation,
  type InvitationActionResult,
  type InvitationPreview,
} from '@/lib/actions/employee-invitation';
import { AuthBrandHeader } from '@/components/auth/auth-brand-header';
import { getPlatformName } from '@/lib/tenant/config';

type Props = {
  token: string;
  preview: InvitationPreview;
};

const initialState: InvitationActionResult | null = null;

function ActionFeedback({ state }: { state: InvitationActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return <p className="form-success">{state.message}</p>;
  }
  return <p className="form-error">{state.error}</p>;
}

export function InvitationActivationForm({ token, preview }: Props) {
  const [state, action, pending] = useActionState(activateInvitation, initialState);
  const platform = getPlatformName();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthBrandHeader />
        <h1 style={{ marginTop: 0 }}>Willkommen bei {platform}</h1>
        <p className="muted">
          Hallo {preview.firstName} {preview.lastName}, bitte aktivieren Sie Ihr Konto.
        </p>

        <form action={action} className="auth-form">
          <input type="hidden" name="token" value={token} />
          <label className="auth-field">
            E-Mail
            <input type="email" value={preview.email} readOnly disabled />
          </label>
          <label className="auth-field">
            Einmalpasswort
            <input
              name="temp_password"
              type="password"
              required
              autoComplete="one-time-code"
              placeholder="Von der Verwaltung erhalten"
            />
          </label>
          <label className="auth-field">
            Neues persönliches Passwort
            <input
              name="new_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="auth-field">
            Passwort bestätigen
            <input
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <ActionFeedback state={state} />
          <div className="auth-form-actions">
            <button type="submit" className="primary-button" disabled={pending}>
              {pending ? 'Konto wird aktiviert…' : 'Konto aktivieren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
