'use client';

import { useState } from 'react';

export function GenerateReportButton({ dailyLogId, label }: { dailyLogId: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setMessage(null);
    const res = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyLogId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? 'Fehler');
    } else {
      setMessage('Rapport erstellt');
      window.location.reload();
    }
    setLoading(false);
  }

  return (
    <div className="inline-actions">
      <button type="button" className="secondary-button" onClick={generate} disabled={loading}>
        {loading ? 'Erzeugt…' : label}
      </button>
      {message && <span className="muted">{message}</span>}
    </div>
  );
}
