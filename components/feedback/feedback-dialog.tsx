'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { submitFeedbackReport } from '@/lib/actions/feedback';
import { AppDialog, NoticeDialog } from '@/components/ui/app-dialogs';
import { ScreenshotDropzone } from '@/components/feedback/screenshot-dropzone';
import type { FeedbackReportKind } from '@/lib/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackDialog({ open, onClose }: Props) {
  const pathname = usePathname();
  const [kind, setKind] = useState<FeedbackReportKind>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setKind('bug');
    setTitle('');
    setDescription('');
    setScreenshots([]);
    setError(null);
  }

  const handleClose = useCallback(() => {
    if (pending) return;
    resetForm();
    onClose();
  }, [onClose, pending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('kind', kind);
    formData.set('title', title.trim());
    formData.set('description', description.trim());
    formData.set('page_url', typeof window !== 'undefined' ? window.location.href : pathname);
    formData.set('user_agent', typeof navigator !== 'undefined' ? navigator.userAgent : '');
    for (const file of screenshots) {
      formData.append('screenshots', file);
    }

    startTransition(async () => {
      const result = await submitFeedbackReport(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetForm();
      onClose();
      setSuccessOpen(true);
    });
  }

  return (
    <>
      <AppDialog
        open={open}
        onClose={handleClose}
        title="Feedback / Bug melden"
        panelClassName="dialog-panel--feedback"
        footer={
          <div className="dialog-actions dialog-panel-footer">
            <button type="button" className="text-button" onClick={handleClose} disabled={pending}>
              Abbrechen
            </button>
            <button
              type="submit"
              form="feedback-report-form"
              className="primary-button"
              disabled={pending}
            >
              {pending ? 'Wird gesendet…' : 'Absenden'}
            </button>
          </div>
        }
      >
        <form id="feedback-report-form" className="feedback-dialog-form" onSubmit={handleSubmit}>
          <div className="feedback-kind-toggle" role="group" aria-label="Art der Meldung">
            <button
              type="button"
              className={kind === 'bug' ? 'active' : ''}
              onClick={() => setKind('bug')}
              disabled={pending}
            >
              Bug
            </button>
            <button
              type="button"
              className={kind === 'feedback' ? 'active' : ''}
              onClick={() => setKind('feedback')}
              disabled={pending}
            >
              Feedback
            </button>
          </div>

          <label className="dialog-field">
            Titel
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              disabled={pending}
              placeholder="Kurze Zusammenfassung"
            />
          </label>

          <label className="dialog-field">
            Beschreibung
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={8000}
              rows={5}
              disabled={pending}
              placeholder="Was ist passiert? Was haben Sie erwartet?"
            />
          </label>

          <ScreenshotDropzone files={screenshots} onChange={setScreenshots} disabled={pending} />

          {error ? <p className="dialog-error">{error}</p> : null}
        </form>
      </AppDialog>

      <NoticeDialog
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Danke!"
        message="Ihre Meldung wurde übermittelt. Wir melden uns bei Bedarf."
        variant="success"
      />
    </>
  );
}
