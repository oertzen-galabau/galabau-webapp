'use client';

import { createContext, useContext } from 'react';

const GpsEnabledContext = createContext(true);

/** Mandanten-Einstellung „GPS aktiv“ für alle Client-Komponenten unterhalb des App-Layouts. */
export function GpsProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <GpsEnabledContext.Provider value={enabled}>{children}</GpsEnabledContext.Provider>;
}

export function useGpsEnabled(): boolean {
  return useContext(GpsEnabledContext);
}
