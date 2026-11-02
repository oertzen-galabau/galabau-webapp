'use client';

import { NavigationPendingProvider } from '@/components/app-shell/navigation-pending-context';
import { NavigationProgressBar } from '@/components/app-shell/navigation-progress-bar';

export function NavigationPendingRoot({ children }: { children: React.ReactNode }) {
  return (
    <NavigationPendingProvider>
      <NavigationProgressBar />
      {children}
    </NavigationPendingProvider>
  );
}
