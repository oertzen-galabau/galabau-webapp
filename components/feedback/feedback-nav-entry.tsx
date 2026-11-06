'use client';

import { Bug } from 'lucide-react';
import { useState } from 'react';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';

type Props = {
  className?: string;
  onNavigate?: () => void;
};

export function FeedbackNavEntry({ className = '', onNavigate }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={['feedback-nav-button', className].filter(Boolean).join(' ')}
        onClick={() => {
          setOpen(true);
          onNavigate?.();
        }}
      >
        <Bug size={19} />
        <span>Feedback / Bug</span>
      </button>
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
