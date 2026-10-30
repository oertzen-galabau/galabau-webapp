import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeBookingPreview } from './booking-rules';
import { deserializeTenantConfig } from './tenant-rules';
import type { DriverTrip } from '@/lib/types/database';

const tenantConfig = deserializeTenantConfig({
  rules: [],
  codeLabels: {},
  activeCodes: [],
});

function previewForTrip(driverTrip: DriverTrip) {
  return computeBookingPreview({
    entry: {
      work_date: '2026-06-02',
      start_time: '07:00',
      end_time: '16:00',
      breakfast_start: null,
      breakfast_end: null,
      lunch_start: null,
      lunch_end: null,
      travel_minutes: 60,
      work_minutes: 480,
      is_driver: driverTrip !== 'none',
      driver_trip: driverTrip,
    },
    segments: [{ block_type: 'travel', start_time: '07:00', end_time: '08:00' }],
    tenantConfig,
  });
}

describe('computeBookingPreview driver_trip factor', () => {
  it('round_trip: voller Fahrer-Zuschlag und Wegezeit', () => {
    const { lines } = previewForTrip('round_trip');
    const allowance = lines.find((line) => line.unit === 'eur');
    const travel = lines.find((line) => line.booking_code === '2013');
    assert.ok(allowance);
    assert.equal(allowance!.quantity, 6);
    assert.ok(travel);
    assert.equal(travel!.quantity, 1);
  });

  it('outbound: 50 % Zuschlag und Wegezeit', () => {
    const { lines } = previewForTrip('outbound');
    const allowance = lines.find((line) => line.unit === 'eur');
    const travel = lines.find((line) => line.booking_code === '2013');
    assert.ok(allowance);
    assert.equal(allowance!.quantity, 3);
    assert.ok(travel);
    assert.equal(travel!.quantity, 0.5);
  });

  it('none: kein Fahrer-Zuschlag, Beifahrer-Wegegeld statt Wegezeit Fahrer', () => {
    const { lines } = previewForTrip('none');
    const allowance = lines.find((line) => line.booking_code === '1004' || line.booking_code === '1005');
    const travel = lines.find((line) => line.booking_code === '2013');
    const passenger = lines.find((line) => line.booking_code === '1006' || line.booking_code === '1007');
    assert.equal(allowance, undefined);
    assert.equal(travel, undefined);
    assert.ok(passenger);
    assert.equal(passenger!.quantity, 6);
  });
});
