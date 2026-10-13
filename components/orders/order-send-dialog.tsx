'use client';

import { useId, useState } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';

type Props = {
  open: boolean;
  onClose: () => void;
  orderIds: string[];
  canMarkOrdered: boolean;
  onSent?: () => void;
};

export function OrderSendDialog({ open, onClose, orderIds, canMarkOrdered, onSent }: Props) {
  const emailId = useId();
  const extraId = useId();
  const [to, setTo] = useState('');
  const [extra, setExtra] = useState('');
  const [markAsOrdered, setMarkAsOrdered] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim()) {
      setError('Bitte eine Empfänger-Adresse angeben.');
      return;
    }
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const extraEmails = extra
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/orders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds,
          to: to.trim(),
          extraEmails: extraEmails.length ? extraEmails : undefined,
          markAsOrdered: canMarkOrdered && markAsOrdered,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        simulated?: boolean;
        message?: string;
        ok?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? 'Versand fehlgeschlagen');
      if (data.simulated) {
        setSuccess(data.message ?? 'Kein SMTP – Versand simuliert.');
      } else {
        setSuccess('Bestellformular gesendet.');
        onSent?.();
        window.setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versand fehlgeschlagen');
    } finally {
      setPending(false);
    }
  }

  const count = orderIds.length;

  return (
    <AppDialog open={open} onClose={onClose} title="Bestellformular per E-Mail">
      <form onSubmit={submit}>
        <p className="muted">
          {count === 1
            ? 'Das PDF wird als Anhang an den Lieferanten gesendet.'
            : `${count} Bestellformulare werden in einer PDF-Datei versendet.`}
        </p>
        <label htmlFor={emailId} style={{ display: 'block', marginTop: 12 }}>
          Empfänger (Lieferant)
          <input
            id={emailId}
            type="email"
            className="text-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label htmlFor={extraId} style={{ display: 'block', marginTop: 12 }}>
          Weitere Empfänger (optional, kommagetrennt)
          <input
            id={extraId}
            type="text"
            className="text-input"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="z. B. buchhaltung@…"
          />
        </label>
        {canMarkOrdered ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input
              type="checkbox"
              checked={markAsOrdered}
              onChange={(e) => setMarkAsOrdered(e.target.checked)}
            />
            Status der Bestellung(en) auf „Bestellt“ setzen
          </label>
        ) : null}
        {error ? <p className="form-error" style={{ marginTop: 12 }}>{error}</p> : null}
        {success ? <p className="muted" style={{ marginTop: 12 }}>{success}</p> : null}
        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button type="button" className="text-button" onClick={onClose} disabled={pending}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Sende…' : 'Senden'}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}
