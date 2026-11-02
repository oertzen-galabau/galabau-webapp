'use client';

import { useNavigationPendingOptional } from '@/components/app-shell/navigation-pending-context';

export function NavigationProgressBar() {
  const ctx = useNavigationPendingOptional();
  const busy = ctx?.isBusy ?? false;

  return (
    <div
      className={`navigation-progress${busy ? ' navigation-progress--active' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={busy}
      aria-hidden={!busy}
    >
      <span className="navigation-progress__bar" />
      <span className="sr-only">{busy ? 'Seite wird geladen …' : ''}</span>
    </div>
  );
}
