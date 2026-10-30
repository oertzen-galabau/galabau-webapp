'use client';

import { AppSelect } from '@/components/ui/app-select';
import type { DriverTrip } from '@/lib/types/database';
import {
  DRIVER_TRIP_SELECT_OPTIONS,
  resolveDriverTrip,
} from '@/lib/time-tracking/driver-trip';

type Props = {
  name?: string;
  entry?: { driver_trip?: DriverTrip | null; is_driver?: boolean | null } | null;
  value?: DriverTrip;
  defaultValue?: DriverTrip;
  onValueChange?: (value: DriverTrip) => void;
  disabled?: boolean;
  className?: string;
};

export function DriverTripSelect({
  name = 'driver_trip',
  entry,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
}: Props) {
  const resolvedDefault = defaultValue ?? (entry ? resolveDriverTrip(entry) : 'none');

  return (
    <AppSelect
      name={name}
      value={value}
      defaultValue={resolvedDefault}
      onValueChange={onValueChange ? (v) => onValueChange(parseDriverTripFromSelect(v)) : undefined}
      options={DRIVER_TRIP_SELECT_OPTIONS}
      allowEmpty={false}
      required
      disabled={disabled}
      className={className}
      aria-label="Fahrt als Fahrer"
    />
  );
}

function parseDriverTripFromSelect(raw: string): DriverTrip {
  if (raw === 'round_trip' || raw === 'outbound' || raw === 'return') return raw;
  return 'none';
}
