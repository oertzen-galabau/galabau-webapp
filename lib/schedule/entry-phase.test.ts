import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleEntryPhase } from '@/lib/schedule/entry-phase';

function berlinAt(isoDate: string, time: string): Date {
  return new Date(`${isoDate}T${time}:00+02:00`);
}

describe('scheduleEntryPhase', () => {
  const entry = {
    start_date: '2026-10-06',
    end_date: '2026-10-08',
    start_time: '07:00:00',
    end_time: '16:00:00',
  };

  it('Zukunft vor Starttag', () => {
    assert.equal(scheduleEntryPhase(entry, berlinAt('2026-10-05', '12:00')), 'future');
  });

  it('Zukunft am Starttag vor Beginn', () => {
    assert.equal(scheduleEntryPhase(entry, berlinAt('2026-10-06', '06:30')), 'future');
  });

  it('Aktiv am Starttag nach Beginn', () => {
    assert.equal(scheduleEntryPhase(entry, berlinAt('2026-10-06', '10:00')), 'active');
  });

  it('Aktiv an einem Zwischentag', () => {
    assert.equal(scheduleEntryPhase(entry, berlinAt('2026-10-07', '08:00')), 'active');
  });

  it('Vergangen am Endtag nach Ende', () => {
    assert.equal(scheduleEntryPhase(entry, berlinAt('2026-10-08', '16:30')), 'past');
  });

  it('Vergangen nach Endtag', () => {
    assert.equal(scheduleEntryPhase(entry, berlinAt('2026-10-09', '09:00')), 'past');
  });

  it('Eintägiger Einsatz', () => {
    const oneDay = { ...entry, end_date: '2026-10-06' };
    assert.equal(scheduleEntryPhase(oneDay, berlinAt('2026-10-06', '15:00')), 'active');
    assert.equal(scheduleEntryPhase(oneDay, berlinAt('2026-10-06', '16:00')), 'past');
  });
});
