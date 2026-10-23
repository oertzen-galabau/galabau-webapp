import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { saveTimeEntry, resubmitTimeEntry } from '@/lib/actions/employee';
import { TimeEntryFormFields } from '@/components/time-tracking/time-entry-form-fields';
import { TimeEntryOverviewRow } from '@/components/time-tracking/time-entry-overview-row';
import { fetchAccessibleSites } from '@/lib/sites/access';
import { todayWorkDate } from '@/lib/time-tracking/work-day';
import { formatMinutes } from '@/lib/utils/time';
import {
  getBadWeatherSeasonFromConfig,
  loadTenantPayrollConfig,
  serializeTenantConfig,
  type BadWeatherConfig,
} from '@/lib/payroll/tenant-rules';
import type { PayrollBooking } from '@/lib/types/database';

export default async function ZeitenPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.zeiten')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const month = todayWorkDate().slice(0, 7);
  const canApprove = canAccess(ctx, 'zeiten.approve');

  const tenantPayrollConfig = await loadTenantPayrollConfig(supabase, ctx.tenant!.id);
  const tenantConfigSerialized = serializeTenantConfig(tenantPayrollConfig);
  const badWeatherCfg = tenantPayrollConfig.rules.get('bad_weather')?.config as BadWeatherConfig | undefined;
  const { season_start: badWeatherSeasonStart, season_end: badWeatherSeasonEnd } =
    getBadWeatherSeasonFromConfig(badWeatherCfg);

  const [
    { data: entries },
    { data: rejectedEntries },
    sites,
    { data: bookingCodes },
  ] = await Promise.all([
    supabase
      .from('time_entries')
      .select('*, sites(name)')
      .eq('user_id', ctx.userId)
      .gte('work_date', `${month}-01`)
      .order('work_date', { ascending: false }),
    supabase
      .from('time_entries')
      .select('*, sites(name)')
      .eq('user_id', ctx.userId)
      .eq('approval_status', 'rejected')
      .order('work_date', { ascending: false }),
    fetchAccessibleSites(supabase, ctx, 'id, name, default_travel_minutes'),
    supabase
      .from('payroll_booking_codes')
      .select('*')
      .eq('tenant_id', ctx.tenant!.id)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  const allEntryIds = (entries ?? []).map((e) => e.id);

  const [{ data: allSegments }, { data: allBookings }] = allEntryIds.length > 0
    ? await Promise.all([
        supabase
          .from('time_entry_segments')
          .select('time_entry_id, site_id, travel_minutes, start_time, end_time, block_type')
          .in('time_entry_id', allEntryIds),
        supabase
          .from('payroll_bookings')
          .select('*')
          .in('time_entry_id', allEntryIds),
      ])
    : [{ data: [] }, { data: [] }];

  const segmentsByEntry = new Map<
    string,
    {
      site_id: string | null;
      travel_minutes: number;
      start_time: string | null;
      end_time: string | null;
      block_type: string;
    }[]
  >();
  for (const seg of allSegments ?? []) {
    const list = segmentsByEntry.get(seg.time_entry_id) ?? [];
    list.push({
      site_id: seg.site_id,
      travel_minutes: seg.travel_minutes,
      start_time: seg.start_time,
      end_time: seg.end_time,
      block_type: seg.block_type ?? 'site_work',
    });
    segmentsByEntry.set(seg.time_entry_id, list);
  }

  const bookingsByEntry = new Map<string, PayrollBooking[]>();
  for (const b of allBookings ?? []) {
    if (!b.time_entry_id) continue;
    const list = bookingsByEntry.get(b.time_entry_id) ?? [];
    list.push(b);
    bookingsByEntry.set(b.time_entry_id, list);
  }

  const codeLabels = Object.fromEntries((bookingCodes ?? []).map((c) => [c.code, c.label]));

  const approvedMinutes = (entries ?? [])
    .filter((e) => e.approval_status === 'approved')
    .reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const today = todayWorkDate();

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meine Zeiten</h1>
          <p>
            Genehmigte Stunden im Monat: {formatMinutes(approvedMinutes)} Std.
            {' '}Buchungsvorschau — finale Lohnbuchungen entstehen nach Freigabe durch das Büro.
          </p>
        </div>
        <div className="page-heading-actions">
          {canApprove && (
            <Link href="/app/zeiten/freigabe" className="text-button">
              Zeiten zur Freigabe →
            </Link>
          )}
          <Link href="/app/zeiten/buchungen" className="text-button">
            Buchungsübersicht →
          </Link>
        </div>
      </div>

      {(rejectedEntries ?? []).length > 0 && (
        <section className="panel form-panel" id="korrektur" style={{ marginBottom: 16 }}>
          <h2>Zu korrigieren</h2>
          <p className="muted">
            Folgende Zeiteinträge wurden abgelehnt. Bitte korrigieren und erneut einreichen.
          </p>
          {(rejectedEntries ?? []).map((entry) => (
            <article key={entry.id} className="time-correction-card">
              <div className="callout callout-danger" style={{ marginBottom: 16 }}>
                <strong>Abgelehnt am {entry.work_date}</strong>
                <p>{entry.rejection_reason}</p>
              </div>
              <form action={resubmitTimeEntry} className="input-form">
                <input type="hidden" name="id" value={entry.id} />
                <TimeEntryFormFields
                  sites={sites}
                  entry={entry}
                  initialBlocks={(segmentsByEntry.get(entry.id) ?? [])
                    .filter((segment) => segment.start_time && segment.end_time)
                    .map((segment) => ({
                      block_type: segment.block_type as import('@/lib/types/database').TimeBlockType,
                      start_time: segment.start_time!.slice(0, 5),
                      end_time: segment.end_time!.slice(0, 5),
                      site_id: segment.site_id,
                      travel_minutes: segment.travel_minutes,
                    }))}
                  submitLabel="Erneut einreichen"
                  compact
                  badWeatherSeasonStart={badWeatherSeasonStart}
                  badWeatherSeasonEnd={badWeatherSeasonEnd}
                />
              </form>
            </article>
          ))}
        </section>
      )}

      <section className="panel form-panel">
        <h2>Neuer Zeiteintrag</h2>
        <form action={saveTimeEntry} className="input-form">
          <TimeEntryFormFields
            sites={sites ?? []}
            submitLabel="Speichern"
            compact
            badWeatherSeasonStart={badWeatherSeasonStart}
            badWeatherSeasonEnd={badWeatherSeasonEnd}
          />
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Tages- und Monatsübersicht</h2>
        <p className="muted">
          Eigene Einträge bearbeiten: bis zur Freigabe. Löschen weiterhin nur innerhalb der letzten drei Tage.
        </p>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Baustelle</th>
                <th className="data-table-col--optional">Start</th>
                <th className="data-table-col--optional">Ende</th>
                <th>Arbeitszeit</th>
                <th>Fahrer</th>
                <th>Status</th>
                <th className="data-table-col--optional">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((entry) => (
                <TimeEntryOverviewRow
                  key={entry.id}
                  entry={entry}
                  sites={sites}
                  today={today}
                  segments={segmentsByEntry.get(entry.id) ?? []}
                  bookings={bookingsByEntry.get(entry.id) ?? []}
                  codeLabels={codeLabels}
                  tenantConfig={tenantConfigSerialized}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
