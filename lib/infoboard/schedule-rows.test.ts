import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildScheduleRowsForDay } from '@/lib/infoboard/schedule-rows';

describe('buildScheduleRowsForDay', () => {
  it('filtert ohne infoboard.schedule_all auf eigene Zuordnung', () => {
    const rows = buildScheduleRowsForDay({
      dayIso: '2026-03-02',
      entries: [
        {
          id: 'a',
          start_time: '07:00',
          end_time: '16:00',
          site_id: 'site-1',
          foreman_user_id: 'foreman-1',
          sites: { name: 'Baustelle Nord', address: 'Str. 1' },
          schedule_entry_members: [
            {
              user_id: 'user-other',
              profiles: { first_name: 'Max', last_name: 'Muster' },
            },
          ],
        },
        {
          id: 'b',
          start_time: '08:00',
          end_time: '17:00',
          site_id: 'site-2',
          foreman_user_id: null,
          sites: { name: 'Baustelle Süd', address: 'Str. 2' },
          schedule_entry_members: [
            {
              user_id: 'user-me',
              profiles: { first_name: 'Lars', last_name: 'Macario' },
            },
          ],
        },
      ],
      appointments: [],
      assignment: null,
      userId: 'user-me',
      canSeeAll: false,
      includeMissingReport: false,
      emptyMessage: 'Leer',
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, 'b');
    assert.ok((rows[0]?.teamLines.length ?? 0) > 0);
  });

  it('zeigt alle Einsätze mit canSeeAll', () => {
    const rows = buildScheduleRowsForDay({
      dayIso: '2026-03-02',
      entries: [
        {
          id: 'a',
          start_time: '07:00',
          end_time: '16:00',
          site_id: 'site-1',
          foreman_user_id: null,
          sites: { name: 'A', address: null },
          schedule_entry_members: [
            { user_id: 'x', profiles: { first_name: 'A', last_name: 'B' } },
          ],
        },
        {
          id: 'b',
          start_time: '08:00',
          end_time: '17:00',
          site_id: 'site-2',
          foreman_user_id: null,
          sites: { name: 'B', address: null },
          schedule_entry_members: [
            { user_id: 'y', profiles: { first_name: 'C', last_name: 'D' } },
          ],
        },
      ],
      appointments: [],
      assignment: null,
      userId: 'user-me',
      canSeeAll: true,
      includeMissingReport: false,
      emptyMessage: 'Leer',
    });

    assert.equal(rows.length, 2);
  });
});
