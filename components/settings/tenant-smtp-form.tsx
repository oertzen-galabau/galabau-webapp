'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  saveTenantSmtpSettingsAction,
  sendTenantSmtpTestMail,
  type SaveTenantSmtpFormState,
} from '@/lib/actions/smtp-settings';
import type { TenantSmtpPublicSettings } from '@/lib/email/tenant-smtp';

const initialState: SaveTenantSmtpFormState = {};

type Props = {
  settings: TenantSmtpPublicSettings | null;
};

export function TenantSmtpForm({ settings }: Props) {
  const [state, action, pending] = useActionState(saveTenantSmtpSettingsAction, initialState);
  const [testPending, startTest] = useTransition();
  const [testMessage, setTestMessage] = useState<string | null>(null);

  function runTest() {
    setTestMessage(null);
    startTest(async () => {
      const result = await sendTenantSmtpTestMail();
      if (result.ok) {
        setTestMessage('Testmail wurde an Ihre Konto-E-Mail gesendet.');
      } else {
        setTestMessage(result.error);
      }
    });
  }

  return (
    <section className="panel form-panel">
      <h2>E-Mail-Versand (SMTP)</h2>
      <p className="muted">
        Rapporte, Bestellformulare und Einsatzpläne werden über Ihr eigenes Postfach versendet.
        Systemmails (Passwort-Reset, Mitarbeiter-Einladungen) laufen immer über die GaLaBau-App.
      </p>

      <form action={action} className="input-form">
        <div className="input-form-core">
          <label>
            SMTP-Host
            <input name="host" required defaultValue={settings?.host ?? ''} placeholder="smtp.example.com" />
          </label>
          <label>
            Port
            <input
              name="port"
              type="number"
              required
              min={1}
              max={65535}
              defaultValue={settings?.port ?? 587}
            />
          </label>
          <label className="input-form-checkbox">
            <input type="checkbox" name="secure" defaultChecked={settings?.secure ?? false} />
            SSL/TLS (secure) — typisch bei Port 465
          </label>
          <label>
            Benutzername
            <input
              name="smtp_user"
              autoComplete="off"
              defaultValue={settings?.smtp_user ?? ''}
              placeholder="optional"
            />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder={settings?.password_configured ? 'Leer lassen = unverändert' : 'Erforderlich'}
            />
          </label>
          <label>
            Absender-E-Mail
            <input
              name="from_email"
              type="email"
              required
              defaultValue={settings?.from_email ?? ''}
              placeholder="office@firma.de"
            />
          </label>
          <label>
            Absender-Name
            <input name="from_name" defaultValue={settings?.from_name ?? ''} placeholder="Firma GmbH" />
          </label>
          <label>
            Reply-To (optional)
            <input
              name="reply_to"
              type="email"
              defaultValue={settings?.reply_to ?? ''}
              placeholder="Antworten an …"
            />
          </label>
          <label className="input-form-checkbox">
            <input type="checkbox" name="enabled" defaultChecked={settings?.enabled !== false} />
            Versand aktiv
          </label>
        </div>
        {state.error ? <p className="form-error">{state.error}</p> : null}
        {state.ok ? <p className="muted">SMTP-Einstellungen gespeichert.</p> : null}
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            {pending ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            type="button"
            className="secondary-button secondary-button--compact"
            disabled={testPending || pending}
            onClick={runTest}
          >
            {testPending ? 'Sende Test…' : 'Testmail senden'}
          </button>
        </div>
      </form>
      {testMessage ? <p className="muted" style={{ marginTop: 8 }}>{testMessage}</p> : null}
      {!settings?.password_configured ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Ohne gespeicherte SMTP-Daten können fachliche E-Mails nicht versendet werden.
        </p>
      ) : null}
    </section>
  );
}
