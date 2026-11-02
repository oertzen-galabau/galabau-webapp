'use client';

import { useState } from 'react';
import { AppNavLink } from '@/components/app-shell/app-nav-link';
import { PrimaryPendingButton } from '@/components/ui/pending-button';
import { useNavigationPending } from '@/components/app-shell/navigation-pending-context';
import { useRouter } from 'next/navigation';
import { requestPasswordResetCode } from '@/lib/actions/password-reset';
import { RESET_EMAIL_SESSION_KEY } from '@/lib/auth/password-reset';
import { AuthBrandHeader } from '@/components/auth/auth-brand-header';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { navigate } = useNavigationPending();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const result = await requestPasswordResetCode(email);

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    sessionStorage.setItem(RESET_EMAIL_SESSION_KEY, email.trim().toLowerCase());
    setInfo(
      result.simulated
        ? `${result.message} (SMTP nicht konfiguriert — in der Entwicklung steht der Code im Server-Log.)`
        : result.message,
    );
    setLoading(false);

    setTimeout(() => {
      navigate('/reset-password');
    }, 1500);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthBrandHeader subtitle="Passwort vergessen" />
        <p className="auth-intro">
          Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen 6-stelligen Code zum Zurücksetzen.
        </p>
        <form onSubmit={onSubmit} className="auth-form">
          <label className="auth-field">
            E-Mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-success">{info}</p>}
          <div className="auth-form-actions">
            <PrimaryPendingButton type="submit" pending={loading} pendingLabel="Code wird gesendet …">
              Code senden
            </PrimaryPendingButton>
          </div>
        </form>
        <p className="auth-footer">
          <AppNavLink href="/login">Zurück zur Anmeldung</AppNavLink>
        </p>
      </div>
    </div>
  );
}
