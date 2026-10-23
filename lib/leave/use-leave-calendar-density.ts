'use client';

import { useSyncExternalStore } from 'react';

export const LEAVE_CAL_PHONE_MEDIA = '(max-width: 760px)';
export const LEAVE_CAL_TABLET_MEDIA = '(min-width: 761px) and (max-width: 1080px)';

export type LeaveCalendarDensity = 'phone' | 'tablet' | 'desktop';

export type LeaveCalendarLayout = {
  density: LeaveCalendarDensity;
  dayColMinPx: number;
  sidebarWidthPx: number;
  showWeekNumbers: boolean;
  rowBasePx: number;
  rowLanePx: number;
  monthHeadPx: number;
  dayHeadPx: number;
};

const LAYOUT: Record<LeaveCalendarDensity, Omit<LeaveCalendarLayout, 'density'>> = {
  phone: {
    dayColMinPx: 22,
    sidebarWidthPx: 118,
    showWeekNumbers: false,
    rowBasePx: 44,
    rowLanePx: 18,
    monthHeadPx: 22,
    dayHeadPx: 46,
  },
  tablet: {
    dayColMinPx: 26,
    sidebarWidthPx: 172,
    showWeekNumbers: true,
    rowBasePx: 48,
    rowLanePx: 20,
    monthHeadPx: 26,
    dayHeadPx: 52,
  },
  desktop: {
    dayColMinPx: 28,
    sidebarWidthPx: 220,
    showWeekNumbers: true,
    rowBasePx: 52,
    rowLanePx: 22,
    monthHeadPx: 28,
    dayHeadPx: 56,
  },
};

export function leaveCalendarLayoutForDensity(density: LeaveCalendarDensity): LeaveCalendarLayout {
  return { density, ...LAYOUT[density] };
}

function readDensity(): LeaveCalendarDensity {
  if (typeof window === 'undefined') return 'phone';
  if (window.matchMedia(LEAVE_CAL_PHONE_MEDIA).matches) return 'phone';
  if (window.matchMedia(LEAVE_CAL_TABLET_MEDIA).matches) return 'tablet';
  return 'desktop';
}

function subscribe(onStoreChange: () => void) {
  const phone = window.matchMedia(LEAVE_CAL_PHONE_MEDIA);
  const tablet = window.matchMedia(LEAVE_CAL_TABLET_MEDIA);
  const handler = () => onStoreChange();
  phone.addEventListener('change', handler);
  tablet.addEventListener('change', handler);
  return () => {
    phone.removeEventListener('change', handler);
    tablet.removeEventListener('change', handler);
  };
}

function getSnapshot(): LeaveCalendarDensity {
  return readDensity();
}

function getServerSnapshot(): LeaveCalendarDensity {
  return 'phone';
}

export function useLeaveCalendarLayout(): LeaveCalendarLayout {
  const density = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return leaveCalendarLayoutForDensity(density);
}
