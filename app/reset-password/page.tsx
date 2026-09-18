'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resetPasswordWithCode } from '@/lib/actions/password-reset';
import { RESET_EMAIL_SESSION_KEY } from '@/lib/auth/password-reset';
import { AuthBrandHeader } from '@/components/auth/auth-brand-header';

function subscribeToResetEmail() {
  return () => {};
}

function getResetEmailSnapshot() {
  return sessionStorage.getItem(RESET_EMAIL_SESSION_KEY) ?? '';
}

function getResetEmailServerSnapshot() {
  return '';
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const email = useSyncExternalStore(
    subscribeToResetEmail,
    getResetEmailSnapshot,
    getResetEmailServerSnapshot,
  );
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      router.replace('/forgot-password');
    }
  }, [email, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);

    const result = await resetPasswordWithCode(email, code, password);

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    sessionStorage.removeItem(RESET_EMAIL_SESSION_KEY);
    router.push('/login?reset=1');
  }

  if (!email) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthBrandHeader subtitle="Neues Passwort setzen" />
        <p className="auth-intro">
          Code für <strong>{email}</strong> eingeben und ein neues Passwort wählen.
        </p>
        <form onSubmit={onSubmit} className="auth-form">
          <label className="auth-field">
            6-stelliger Code
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoComplete="one-time-code"
            />
          </label>
          <label className="auth-field">
            Neues Passwort
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="auth-field">
            Passwort bestätigen
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="auth-form-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Passwort wird gespeichert…' : 'Passwort speichern'}
            </button>
          </div>
        </form>
        <p className="auth-footer">
          <Link href="/forgot-password">Neuen Code anfordern</Link>
          {' · '}
          <Link href="/login">Zur Anmeldung</Link>
        </p>
      </div>
    </div>
  );
}
