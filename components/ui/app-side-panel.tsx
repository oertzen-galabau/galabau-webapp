'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  titleId?: string;
};

const PANEL_TRANSITION = { type: 'tween' as const, duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };
const BACKDROP_TRANSITION = { type: 'tween' as const, duration: 0.22, ease: 'easeOut' as const };

export function AppSidePanel({ open, onClose, title, children, titleId }: Props) {
  const autoId = useId();
  const headingId = titleId ?? autoId;
  const panelRef = useRef<HTMLElement>(null);
  const scrollLockPrev = useRef('');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    scrollLockPrev.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function unlockScroll() {
    document.body.style.overflow = scrollLockPrev.current;
  }

  if (typeof document === 'undefined') return null;

  const panelMotion = reduceMotion
    ? { initial: false as const, animate: { x: 0 }, exit: { x: 0 } }
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
      };

  const backdropMotion = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };

  return createPortal(
    <AnimatePresence onExitComplete={unlockScroll}>
      {open && (
        <div className="app-side-panel-root" role="presentation">
          <motion.button
            type="button"
            className="app-side-panel-backdrop"
            aria-label="Schließen"
            onClick={onClose}
            initial={backdropMotion.initial}
            animate={backdropMotion.animate}
            exit={backdropMotion.exit}
            transition={reduceMotion ? { duration: 0 } : BACKDROP_TRANSITION}
          />
          <motion.aside
            ref={panelRef}
            className="app-side-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            tabIndex={-1}
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={reduceMotion ? { duration: 0 } : PANEL_TRANSITION}
          >
            <header className="app-side-panel-head">
              <h2 id={headingId}>{title}</h2>
              <button type="button" className="text-button app-side-panel-close" onClick={onClose}>
                Schließen
              </button>
            </header>
            <div className="app-side-panel-body">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
