'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HardHat } from 'lucide-react';
import { getPlatformName } from '@/lib/tenant/config';

export default function TenantRequestPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/tenant-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    if (!res.ok) {
      setError('Anfrage konnte nicht gesendet werden.');
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card panel">
          <h1>Vielen Dank!</h1>
          <p>Ihre Anfrage wurde übermittelt. Wir melden uns in Kürze.</p>
          <Link href="/" className="primary-button">Zur Startseite</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card panel">
        <div className="brand-lockup" style={{ border: 0, paddingBottom: 16 }}>
          <span className="brand-symbol"><HardHat size={22} /></span>
          <span><strong>{getPlatformName()}</strong><small>Demo anfragen</small></span>
        </div>
        <p>Demo-Zugang für Ihr Unternehmen anfragen.</p>
        <form onSubmit={onSubmit} className="input-form">
          <div className="input-form-core">
            <label>Firma<input name="company_name" required /></label>
            <label>Ansprechpartner<input name="contact_name" required /></label>
            <label>E-Mail<input name="contact_email" type="email" required /></label>
            <label>Telefon<input name="contact_phone" /></label>
          </div>
          <details className="input-form-extra" open>
            <summary>Nachricht</summary>
            <div className="input-form-extra-grid">
              <label className="input-form-span-full">Nachricht<textarea name="message" rows={4} /></label>
            </div>
          </details>
          {error && <p className="form-error">{error}</p>}
          <div className="input-form-actions">
            <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Senden…' : 'Anfrage senden'}</button>
          </div>
        </form>
        <p className="auth-footer"><Link href="/">Zur Startseite</Link></p>
      </div>
    </div>
  );
}
