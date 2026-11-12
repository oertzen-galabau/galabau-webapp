'use client';

import { useEffect, useState, useTransition } from 'react';
import { appendFeedbackInternalNote } from '@/lib/actions/feedback';
import { displayInternalNoteLog } from '@/lib/feedback/internal-note';

type Props = {
  reportId: string;
  initialLog: string | null;
  disabled?: boolean;
  onAppended: (internalNote: string) => void;
};

export function FeedbackInternalNoteField({
  reportId,
  initialLog,
  disabled,
  onAppended,
}: Props) {
  const [draft, setDraft] = useState('');
  const [log, setLog] = useState(displayInternalNoteLog(initialLog));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLog(displayInternalNoteLog(initialLog));
  }, [initialLog, reportId]);

  function saveNote() {
    const text = draft.trim();
    if (!text || pending || disabled) return;
    setError(null);
    const formData = new FormData();
    formData.set('id', reportId);
    formData.set('text', text);
    startTransition(async () => {
      const result = await appendFeedbackInternalNote(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLog(displayInternalNoteLog(result.internal_note));
      onAppended(result.internal_note);
      setDraft('');
    });
  }

  return (
    <div className="feedback-internal-note-section">
      <span className="feedback-internal-note-label">Interne Notizen</span>
      {log ? (
        <pre className="feedback-internal-note-log" aria-live="polite">
          {log}
        </pre>
      ) : (
        <p className="muted feedback-internal-note-empty">Noch keine internen Notizen.</p>
      )}
      <label className="dialog-field feedback-internal-note-compose">
        <span className="muted feedback-internal-note-hint">Enter speichern · Shift+Enter Zeilenumbruch</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              saveNote();
            }
          }}
          rows={3}
          maxLength={4000}
          disabled={disabled || pending}
          placeholder="Neue Notiz…"
        />
      </label>
      {error ? <p className="dialog-error">{error}</p> : null}
      {pending ? <p className="muted">Wird gespeichert…</p> : null}
    </div>
  );
}
