'use client';

import { useState } from 'react';
import { PromptDialog } from '@/components/ui/app-dialogs';

export function SendReportButton({ reportId, defaultTo }: { reportId: string; defaultTo?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(to: string) {
    setDialogOpen(false);
    setLoading(true);
    setMessage(null);
    const res = await fetch('/api/reports/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, to }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? 'Fehler beim Versand');
    } else if (data.simulated) {
      setMessage(data.message ?? 'Versand simuliert (SMTP nicht konfiguriert)');
    } else {
      setMessage('Rapport gesendet');
      window.location.reload();
    }
    setLoading(false);
  }

  return (
    <div className="inline-actions">
      <button type="button" className="text-button" onClick={() => setDialogOpen(true)} disabled={loading}>
        {loading ? 'Sende…' : 'Senden'}
      </button>
      {message && <span className="muted">{message}</span>}
      <PromptDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={send}
        title="Rapport senden"
        message="An welche E-Mail-Adresse soll der Rapport gesendet werden?"
        label="E-Mail-Adresse"
        defaultValue={defaultTo ?? ''}
        inputType="email"
        submitLabel="Senden"
        pending={loading}
      />
    </div>
  );
}
