import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findEquipmentUsageOnPlanDates } from '@/lib/schedule/equipment-day-exclusive';

const entries = [
  {
    id: 'entry-a',
    start_date: '2026-10-09',
    site: { name: 'Kronskamp' },
    equipment: [{ equipment_id: 'eq1', name: 'Bagger A' }],
  },
  {
    id: 'entry-b',
    start_date: '2026-10-10',
    site: { name: 'Petunienweg' },
    equipment: [{ equipment_id: 'eq2', name: 'Radlader' }],
  },
];

describe('findEquipmentUsageOnPlanDates', () => {
  it('findet Verwendung an Plan-Tag', () => {
    const usage = findEquipmentUsageOnPlanDates(entries, ['2026-10-09'], 'eq1');
    assert.equal(usage?.siteName, 'Kronskamp');
    assert.equal(usage?.entryId, 'entry-a');
  });

  it('ignoriert aktuellen Einsatz beim Bearbeiten', () => {
    const usage = findEquipmentUsageOnPlanDates(entries, ['2026-10-09'], 'eq1', 'entry-a');
    assert.equal(usage, undefined);
  });

  it('blockiert bei einem von mehreren Plan-Tagen', () => {
    const usage = findEquipmentUsageOnPlanDates(entries, ['2026-10-11', '2026-10-09'], 'eq1');
    assert.equal(usage?.date, '2026-10-09');
  });
});
