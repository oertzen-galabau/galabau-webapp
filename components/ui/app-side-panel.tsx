'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  titleId?: string;
};

export function AppSidePanel({ open, onClose, title, children, titleId }: Props) {
  const autoId = useId();
  const headingId = titleId ?? autoId;
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="app-side-panel-root" role="presentation">
      <button type="button" className="app-side-panel-backdrop" aria-label="Schließen" onClick={onClose} />
      <aside
        ref={panelRef}
        className="app-side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <header className="app-side-panel-head">
          <h2 id={headingId}>{title}</h2>
          <button type="button" className="text-button app-side-panel-close" onClick={onClose}>
            Schließen
          </button>
        </header>
        <div className="app-side-panel-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
