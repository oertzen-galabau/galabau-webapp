import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDayIndexRanges, siteDayIndicesInWeek } from '@/lib/schedule/site-planning-days';

describe('formatDayIndexRanges', () => {
  const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  it('formatiert einzelne Tage', () => {
    assert.equal(formatDayIndexRanges([0, 2], labels), 'Mo, Mi');
  });

  it('formatiert Bereiche', () => {
    assert.equal(formatDayIndexRanges([0, 2, 3, 4], labels), 'Mo, Mi–Fr');
  });

  it('formatiert ganze Woche', () => {
    assert.equal(formatDayIndexRanges([0, 1, 2, 3, 4, 5], labels), 'Mo–Sa');
  });
});

describe('siteDayIndicesInWeek', () => {
  const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];

  it('sammelt Tage pro Baustelle', () => {
    const map = siteDayIndicesInWeek(
      [
        { site_id: 'a', start_date: '2026-10-05', end_date: '2026-10-05' },
        { site_id: 'a', start_date: '2026-10-08', end_date: '2026-10-10' },
        { site_id: 'b', start_date: '2026-10-06', end_date: '2026-10-07' },
      ],
      week,
    );
    assert.deepEqual([...map.get('a')!].sort(), [0, 3, 4, 5]);
    assert.deepEqual([...map.get('b')!].sort(), [1, 2]);
  });
});
