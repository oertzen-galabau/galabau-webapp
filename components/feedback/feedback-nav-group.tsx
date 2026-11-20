'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { AppNavLink } from '@/components/app-shell/app-nav-link';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';
import { FeedbackNavEntry } from '@/components/feedback/feedback-nav-entry';

type Props = {
  onNavigate?: () => void;
  /** z. B. `mobile-drawer-feedback` im Mobile-Menü */
  feedbackButtonClassName?: string;
};

export function FeedbackNavGroup({ onNavigate, feedbackButtonClassName = '' }: Props) {
  const pathname = usePathname();
  const boardActive = pathname === '/app/feedback';
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Drawer unmountet diese Gruppe — Menü erst nach Dialog-Schließen schließen, sonst verschwindet der Dialog.
  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    onNavigate?.();
  }, [onNavigate]);

  return (
    <>
      <div className="feedback-nav-section">
        <FeedbackNavEntry
          className={feedbackButtonClassName}
          onOpen={() => setFeedbackOpen(true)}
        />
        <AppNavLink
          href="/app/feedback"
          className={['feedback-nav-sub', boardActive ? 'active' : ''].filter(Boolean).join(' ')}
          aria-current={boardActive ? 'page' : undefined}
          onClick={() => onNavigate?.()}
        >
          Offene Tasks
        </AppNavLink>
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={closeFeedback} />
    </>
  );
}
