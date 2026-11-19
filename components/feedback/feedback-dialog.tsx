'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef, useState, useTransition } from 'react';
import { submitFeedbackReport } from '@/lib/actions/feedback';
import { AppDialog, NoticeDialog } from '@/components/ui/app-dialogs';
import { ScreenshotDropzone, type ScreenshotDropzoneHandle } from '@/components/feedback/screenshot-dropzone';
import {
  FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH,
  bugSubmitError,
} from '@/lib/feedback/submit-rules';
import type { FeedbackReportKind } from '@/lib/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackDialog({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [kind, setKind] = useState<FeedbackReportKind>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const screenshotDropzoneRef = useRef<ScreenshotDropzoneHandle>(null);

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

    const trimmedDescription = description.trim();
    if (kind === 'bug') {
      const bugError = bugSubmitError(trimmedDescription, screenshots.length);
      if (bugError) {
        setError(bugError);
        return;
      }
    }

    const formData = new FormData();
    formData.set('kind', kind);
    formData.set('title', title.trim());
    formData.set('description', trimmedDescription);
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
      const sentId = result.id;
      resetForm();
      onClose();
      if (pathname === '/app/feedback') {
        const qs = new URLSearchParams({ thanks: '1', sent: sentId });
        router.replace(`/app/feedback?${qs.toString()}`);
        router.refresh();
      } else {
        setSuccessOpen(true);
      }
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
        <form
          id="feedback-report-form"
          className="feedback-dialog-form"
          onSubmit={handleSubmit}
          onPaste={(e) => {
            if (screenshotDropzoneRef.current?.pasteFromClipboard(e.clipboardData)) {
              e.preventDefault();
            }
          }}
        >
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
              minLength={kind === 'bug' ? FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH : 1}
              maxLength={8000}
              rows={5}
              disabled={pending}
              placeholder={
                kind === 'bug'
                  ? `Was ist passiert? Was haben Sie erwartet? (min. ${FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH} Zeichen)`
                  : 'Was ist passiert? Was haben Sie erwartet?'
              }
            />
          </label>

          <ScreenshotDropzone
            ref={screenshotDropzoneRef}
            files={screenshots}
            onChange={setScreenshots}
            disabled={pending}
            required={kind === 'bug'}
          />

          {error ? <p className="dialog-error">{error}</p> : null}
        </form>
      </AppDialog>

      <NoticeDialog
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Danke!"
        message="Ihre Meldung wurde übermittelt. Sie können auf dieser Seite weiterarbeiten."
        variant="success"
      />
    </>
  );
}
