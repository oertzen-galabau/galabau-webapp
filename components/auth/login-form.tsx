'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { clearSupabaseAuthCookies } from '@/lib/supabase/auth-cookies';
import { createClient } from '@/lib/supabase/client';
import { AuthBrandHeader } from '@/components/auth/auth-brand-header';

export function LoginForm() {
  const searchParams = useSearchParams();
  const resetSuccess = useMemo(() => searchParams.get('reset') === '1', [searchParams]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    clearSupabaseAuthCookies();
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role, tenant_id, tenants(slug)').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').single();

    if (profile?.role === 'superadmin') {
      window.location.href = '/superadmin';
      return;
    }

    const tenantSlug = (profile?.tenants as { slug?: string } | null)?.slug;
    if (tenantSlug) {
      document.cookie = `tenant_slug=${tenantSlug}; path=/; max-age=31536000`;
      window.location.href = '/app';
      return;
    }

    setError('Kein Mandant zugewiesen.');
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthBrandHeader />
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
          <label className="auth-field">
            Passwort
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <p className="auth-inline-link">
            <Link href="/forgot-password">Passwort vergessen?</Link>
          </p>
          {resetSuccess && <p className="form-success">Passwort wurde geändert. Bitte anmelden.</p>}
          {error && <p className="form-error">{error}</p>}
          <div className="auth-form-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Wird angemeldet…' : 'Anmelden'}
            </button>
          </div>
        </form>
        <p className="auth-footer">
          Noch kein Konto? <Link href="/register">Kostenlos testen</Link>
          {' · '}
          <Link href="/">Zur Startseite</Link>
        </p>
      </div>
    </div>
  );
}
