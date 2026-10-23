import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { daysInYear } from '@/lib/leave/calendar-month';
import {
  layoutTenantClosureBars,
  tenantClosureDayAbbrev,
  tenantClosureForDay,
  tenantClosureItems,
  tenantClosureLegendEntries,
  tenantClosurePinForDay,
  tenantClosureTitlesForDay,
  pickTenantClosureDayInViewport,
} from '@/lib/leave/calendar-tenant-closures';

describe('calendar-tenant-closures', () => {
  const days = daysInYear('2026');

  it('clippt Betriebsurlaub auf sichtbares Jahr', () => {
    const items = tenantClosureItems(
      [{ id: '1', title: 'Weihnachten', start_date: '2026-12-23', end_date: '2027-01-08' }],
      [],
    );
    const layout = layoutTenantClosureBars(items, days);
    assert.equal(layout.length, 1);
    assert.equal(layout[0]!.colStart, days.indexOf('2026-12-23'));
    assert.equal(layout[0]!.colSpan, 9);
  });

  it('markiert Brückentag vor Betriebsferien', () => {
    assert.equal(
      tenantClosureForDay(
        '2026-05-15',
        [{ start_date: '2026-05-01', end_date: '2026-05-31' }],
        [{ date: '2026-05-15' }],
      ),
      'bridge',
    );
  });

  it('baut Tooltip-Text für einen Tag', () => {
    assert.equal(
      tenantClosureTitlesForDay(
        '2026-12-24',
        [{ title: 'Weihnachten/Neujahr', start_date: '2026-12-23', end_date: '2027-01-08' }],
        [],
      ),
      'Weihnachten/Neujahr',
    );
  });

  it('kürzt Tages-Label', () => {
    assert.equal(tenantClosureDayAbbrev('Weihnachten/Neujahr', 5), 'Weih…');
  });

  it('baut Legende für sichtbares Jahr', () => {
    const legend = tenantClosureLegendEntries(
      days,
      [{ id: '1', title: 'Weihnachten/Neujahr', start_date: '2026-12-23', end_date: '2027-01-08' }],
      [],
    );
    assert.equal(legend.length, 1);
    assert.match(legend[0]!.rangeLabel, /23\.12\.2026/);
  });

  it('baut Pin-Daten für Touch-Hinweis', () => {
    const pin = tenantClosurePinForDay(
      '2026-12-24',
      [{ title: 'Weihnachten/Neujahr', start_date: '2026-12-23', end_date: '2027-01-08' }],
      [],
    );
    assert.ok(pin);
    assert.equal(pin!.kindLabel, 'Betriebsferien');
    assert.equal(pin!.titles, 'Weihnachten/Neujahr');
    assert.match(pin!.dateLabelLong, /2026/);
  });

  it('wählt Betriebsferien-Tag in der sichtbaren Timeline', () => {
    const holidays = [
      { start_date: '2026-12-23', end_date: '2027-01-08' },
    ];
    const dec23Index = days.indexOf('2026-12-23');
    const col = 22;
    const sidebar = 118;
    const visibleCols = 5;
    const picked = pickTenantClosureDayInViewport({
      scrollLeft: Math.max(0, (dec23Index - 2) * col),
      scrollClientWidth: sidebar + col * visibleCols,
      sidebarWidthPx: sidebar,
      colWidthPx: col,
      days,
      companyHolidays: holidays,
      bridgeDays: [],
    });
    assert.equal(picked, '2026-12-23');
  });
});
