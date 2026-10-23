'use client';

import { useSyncExternalStore } from 'react';
import { DAY_TIMELINE_COMPACT_MEDIA_QUERY } from '@/lib/schedule/day-timeline';

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(DAY_TIMELINE_COMPACT_MEDIA_QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(DAY_TIMELINE_COMPACT_MEDIA_QUERY).matches;
}

function getServerSnapshot() {
  return true;
}

/** Schmaler Viewport → max. 3 Baustellen nebeneinander im Tagesraster. */
export function useDayTimelineCompactViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
