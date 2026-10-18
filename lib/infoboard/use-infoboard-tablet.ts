'use client';

import { useSyncExternalStore } from 'react';

const TABLET_QUERY = '(min-width: 761px) and (max-width: 1080px)';

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(TABLET_QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(TABLET_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useInfoboardTablet() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
