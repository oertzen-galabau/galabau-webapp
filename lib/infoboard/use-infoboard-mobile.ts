'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 760px)';

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
  return true;
}

export function useInfoboardMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
