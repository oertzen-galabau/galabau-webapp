'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { EmployeeInviteResult } from '@/lib/actions/admin';

type Props = {
  title: string;
  result: Extract<EmployeeInviteResult, { ok: true }>;
};

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EmployeeInviteCredentials({ title, result }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(label);
    window.setTimeout(() => setCopiedField(null), 2000);
  }

  const allText = [
    `Einladungslink: ${result.inviteUrl}`,
    `E-Mail: ${result.email}`,
    `Einmalpasswort: ${result.tempPassword}`,
    `Gültig bis: ${formatExpiry(result.expiresAt)}`,
  ].join('\n');

  return (
    <div className="invite-credentials panel" style={{ marginBottom: 16 }}>
      <h3>{title}</h3>
      <p className="muted">
        Diese Zugangsdaten werden nur einmal angezeigt. Senden Sie Link und Einmalpasswort manuell an{' '}
        <strong>{result.firstName}</strong> ({result.email}).
      </p>

      <dl className="invite-credentials-list">
        <div>
          <dt>Einladungslink</dt>
          <dd>
            <div className="invite-credentials-value">
              <code>{result.inviteUrl}</code>
            </div>
            <div className="invite-credentials-actions">
              <button type="button" className="text-button" onClick={() => copyText('link', result.inviteUrl)}>
                {copiedField === 'link' ? 'Kopiert' : 'Link kopieren'}
              </button>
            </div>
          </dd>
        </div>
        <div>
          <dt>E-Mail</dt>
          <dd>
            <div className="invite-credentials-value">
              <code>{result.email}</code>
            </div>
          </dd>
        </div>
        <div>
          <dt>Einmalpasswort</dt>
          <dd>
            <div className="invite-credentials-value">
              <code>{result.tempPassword}</code>
            </div>
            <div className="invite-credentials-actions">
              <button type="button" className="text-button" onClick={() => copyText('password', result.tempPassword)}>
                {copiedField === 'password' ? 'Kopiert' : 'Passwort kopieren'}
              </button>
            </div>
          </dd>
        </div>
        <div>
          <dt>Gültig bis</dt>
          <dd>{formatExpiry(result.expiresAt)}</dd>
        </div>
      </dl>

      <div className="inline-actions">
        <button type="button" className="primary-button primary-button--compact" onClick={() => copyText('all', allText)}>
          {copiedField === 'all' ? 'Alles kopiert' : 'Alles kopieren'}
        </button>
      </div>

      {result.emailSent ? (
        <p className="form-success">Einladung wurde zusätzlich per E-Mail versendet.</p>
      ) : (
        <p className="muted">
          E-Mail-Versand: {result.emailMessage ?? 'Nicht versendet — bitte manuell weitergeben.'}
        </p>
      )}

      <p className="muted invite-credentials-recovery">
        Nach dem Schließen dieser Seite sind Link und Einmalpasswort nicht erneut abrufbar. Bei Verlust können Sie im{' '}
        <Link href={`/app/team/${result.userId}?tab=rolle`}>Mitarbeiterprofil unter „Rolle &amp; Zugriff“</Link>{' '}
        neue Zugangsdaten erzeugen.
      </p>
    </div>
  );
}
