'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { clearSupabaseAuthCookies } from '@/lib/supabase/auth-cookies';
import { createClient } from '@/lib/supabase/client';
import { registerTenant, type RegisterPlan } from '@/lib/actions/register';
import { getRootDomain } from '@/lib/tenant/config';
import { AuthBrandHeader } from '@/components/auth/auth-brand-header';

const PLANS: { id: RegisterPlan; label: string; price: string }[] = [
  { id: 'solo', label: 'Solo · 1 Nutzer', price: '79 €/Monat' },
  { id: 'team', label: 'Team · bis 5 Nutzer', price: '149 €/Monat' },
  { id: 'max', label: 'Max · bis 10 Nutzer', price: '299 €/Monat' },
];

function parsePlan(value: string | null): RegisterPlan {
  if (value === 'solo' || value === 'team' || value === 'max') return value;
  return 'team';
}

export function RegisterForm() {
  const searchParams = useSearchParams();
  const initialPlan = useMemo(() => parsePlan(searchParams.get('plan')), [searchParams]);
  const rootDomain = getRootDomain();
  const rootHost = rootDomain.split(':')[0];

  const [plan, setPlan] = useState<RegisterPlan>(initialPlan);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');

    try {
      const result = await registerTenant({
        companyName: String(form.get('company_name') ?? ''),
        slug: String(form.get('slug') ?? ''),
        firstName: String(form.get('first_name') ?? ''),
        lastName: String(form.get('last_name') ?? ''),
        email: String(form.get('email') ?? ''),
        password,
        plan,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      clearSupabaseAuthCookies();
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });

      if (signInError) {
        window.location.href = '/login?registered=1';
        return;
      }

      document.cookie = `tenant_slug=${result.slug}; path=/; max-age=31536000`;
      window.location.href = '/app';
    } catch {
      setError('Registrierung fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <AuthBrandHeader subtitle="7 Tage kostenlos testen" />
        <form onSubmit={onSubmit} className="auth-form">
          <label className="auth-field">
            Firma
            <input name="company_name" required placeholder="z. B. Mustermann GaLaBau" />
          </label>
          <label className="auth-field">
            Subdomain
            <input
              name="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
              title="Nur Kleinbuchstaben, Zahlen und Bindestriche"
              placeholder="z. B. ihr-betrieb"
            />
          </label>
          <p className="auth-subdomain-hint">
            Ihre Adresse: <strong>{slug || 'ihr-betrieb'}.{rootHost}</strong>
          </p>
          <label className="auth-field">
            Vorname
            <input name="first_name" required autoComplete="given-name" />
          </label>
          <label className="auth-field">
            Nachname
            <input name="last_name" required autoComplete="family-name" />
          </label>
          <label className="auth-field">
            E-Mail
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label className="auth-field">
            Passwort
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <fieldset className="register-plan-fieldset">
            <legend>Paket wählen</legend>
            <div className="register-plan-options">
              {PLANS.map(({ id, label, price }) => (
                <label key={id} className={`register-plan-option${plan === id ? ' active' : ''}`}>
                  <input
                    type="radio"
                    name="plan_choice"
                    value={id}
                    checked={plan === id}
                    onChange={() => setPlan(id)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{price} nach Testphase · 12 Monate Mindestlaufzeit</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="form-error">{error}</p>}
          <div className="auth-form-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Wird eingerichtet…' : 'Kostenlos testen'}
            </button>
          </div>
        </form>
        <p className="auth-footer">
          Bereits registriert? <Link href="/login">Anmelden</Link>
          {' · '}
          <Link href="/">Zur Startseite</Link>
        </p>
      </div>
    </div>
  );
}
