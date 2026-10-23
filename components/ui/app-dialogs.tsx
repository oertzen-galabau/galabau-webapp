'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

let openDialogCount = 0;

function lockDocumentScroll() {
  openDialogCount += 1;
  if (openDialogCount === 1) {
    document.documentElement.classList.add('dialog-open');
  }
}

function unlockDocumentScroll() {
  openDialogCount = Math.max(0, openDialogCount - 1);
  if (openDialogCount === 0) {
    document.documentElement.classList.remove('dialog-open');
  }
}

type AppDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Zweite Zeile unter dem Titel (z. B. Datum in Bild-Lightbox). */
  subtitle?: string;
  children: React.ReactNode;
  titleId?: string;
  panelClassName?: string;
  /** Aktionen und Fehler — außerhalb des scrollbaren Bereichs (z. B. Handy). */
  footer?: React.ReactNode;
};

export function AppDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  titleId,
  panelClassName,
  footer,
}: AppDialogProps) {
  const autoId = useId();
  const headingId = titleId ?? autoId;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    lockDocumentScroll();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      unlockDocumentScroll();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className={panelClassName ? `dialog-panel ${panelClassName}` : 'dialog-panel'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {subtitle ? (
          <div className="dialog-panel-titleblock">
            <h2 id={headingId}>{title}</h2>
            <p className="dialog-panel-subtitle">{subtitle}</p>
          </div>
        ) : (
          <h2 id={headingId}>{title}</h2>
        )}
        <div className="dialog-panel-body">{children}</div>
        {footer}
      </div>
    </div>,
    document.body,
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  danger = false,
  pending = false,
}: ConfirmDialogProps) {
  return (
    <AppDialog open={open} onClose={onClose} title={title}>
      <p className="muted">{message}</p>
      <div className="dialog-actions">
        <button type="button" className="text-button" onClick={onClose} disabled={pending}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? 'primary-button primary-button--danger' : 'primary-button'}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? 'Bitte warten…' : confirmLabel}
        </button>
      </div>
    </AppDialog>
  );
}

type PromptDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  label: string;
  defaultValue?: string;
  inputType?: 'text' | 'email';
  submitLabel?: string;
  pending?: boolean;
  required?: boolean;
};

export function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  message,
  label,
  defaultValue = '',
  inputType = 'text',
  submitLabel = 'OK',
  pending = false,
  required = true,
}: PromptDialogProps) {
  return (
    <AppDialog open={open} onClose={onClose} title={title}>
      {message && <p className="muted">{message}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get('prompt_value');
          onSubmit(String(value ?? '').trim());
        }}
      >
        <label className="dialog-field">
          {label}
          <input
            key={defaultValue}
            name="prompt_value"
            type={inputType}
            defaultValue={defaultValue}
            required={required}
            autoFocus
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={pending}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Bitte warten…' : submitLabel}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

type NoticeDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'success' | 'error';
};

export function NoticeDialog({
  open,
  onClose,
  title,
  message,
  variant = 'success',
}: NoticeDialogProps) {
  return (
    <AppDialog open={open} onClose={onClose} title={title}>
      <p className={variant === 'error' ? 'dialog-error' : 'muted'}>{message}</p>
      <div className="dialog-actions">
        <button type="button" className="primary-button" onClick={onClose}>
          OK
        </button>
      </div>
    </AppDialog>
  );
}
