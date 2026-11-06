'use client';

import { Bug } from 'lucide-react';

type Props = {
  className?: string;
  onOpen?: () => void;
};

export function FeedbackNavEntry({ className = '', onOpen }: Props) {
  return (
    <button
      type="button"
      className={['feedback-nav-button', className].filter(Boolean).join(' ')}
      onClick={() => onOpen?.()}
    >
      <Bug size={19} />
      <span>Feedback / Bug</span>
    </button>
  );
}
