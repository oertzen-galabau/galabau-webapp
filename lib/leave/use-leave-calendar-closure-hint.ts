'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  tenantClosureForDay,
  tenantClosurePinForDay,
  type TenantClosurePin,
} from '@/lib/leave/calendar-tenant-closures';

type ClosureSources = {
  companyHolidays: { title: string; start_date: string; end_date: string }[];
  bridgeDays: { title: string; date: string }[];
};

type Args = ClosureSources & {
  enabled: boolean;
  /** Jahr o. ä. — schließt offenen Chip bei Navigation. */
  resetKey: string;
};

/** Touch: Tag per Antippen einer farbigen Spalte — ohne Scroll-Banner. */
export function useLeaveCalendarClosureHint({
  enabled,
  companyHolidays,
  bridgeDays,
  resetKey,
}: Args): {
  pin: TenantClosurePin | null;
  onClosureDayTap: (day: string) => void;
  clearPin: () => void;
} {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [companyHolidays, bridgeDays, resetKey]);

  const pin =
    selectedDay != null
      ? tenantClosurePinForDay(selectedDay, companyHolidays, bridgeDays)
      : null;

  const onClosureDayTap = useCallback(
    (day: string) => {
      if (!enabled) return;
      if (!tenantClosureForDay(day, companyHolidays, bridgeDays)) return;
      setSelectedDay((prev) => (prev === day ? null : day));
    },
    [bridgeDays, companyHolidays, enabled],
  );

  const clearPin = useCallback(() => setSelectedDay(null), []);

  return { pin, onClosureDayTap, clearPin };
}
