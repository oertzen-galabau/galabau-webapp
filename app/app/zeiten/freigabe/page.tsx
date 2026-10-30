import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { BadWeatherFreigabeControl } from '@/components/payroll/bad-weather-freigabe-control';
import { TimeApprovalRow } from '@/components/payroll/time-approval-row';
import { approvalEmptyQuip } from '@/lib/time-tracking/approval-empty-quips';
import { todayWorkDate } from '@/lib/time-tracking/work-day';
import { isBadWeatherForPreview } from '@/lib/payroll/bad-weather-entry';
import { loadTenantPayrollConfig, serializeTenantConfig } from '@/lib/payroll/tenant-rules';
import type { PayrollBooking, TimeBlockType } from '@/lib/types/database';

export default async function ZeitenFreigabePage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'zeiten.approve')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const supabase = await createClient();
  const canEditBookings = canAccess(ctx, 'zeiten.bookings.edit');
  const canMarkBadWeather = canAccess(ctx, 'zeiten.bad_weather.mark');

  const tenantPayrollConfig = await loadTenantPayrollConfig(supabase, ctx.tenant!.id);
  const tenantConfigSerialized = serializeTenantConfig(tenantPayrollConfig);

  const [
    { data: pendingEntries, error: pendingEntriesError },
    { data: bookingCodes },
    { data: badWeatherDays },
  ] = await Promise.all([
    supabase
      .from('time_entries')
      .select('*, sites(name), profiles!time_entries_user_id_fkey(first_name, last_name)')
      .eq('approval_status', 'pending')
      .order('submitted_at', { ascending: true }),
    supabase
      .from('payroll_booking_codes')
      .select('*')
      .eq('tenant_id', ctx.tenant!.id)
      .eq('is_active', true)
      .order('sort_order'),
    canMarkBadWeather
      ? supabase
          .from('bad_weather_days')
          .select('work_date')
          .eq('tenant_id', ctx.tenant!.id)
      : Promise.resolve({ data: [] as { work_date: string }[] }),
  ]);

  const pendingIds = (pendingEntries ?? []).map((e) => e.id);

  const [{ data: allSegments }, { data: allBookings }] = pendingIds.length > 0
    ? await Promise.all([
        supabase
          .from('time_entry_segments')
          .select('time_entry_id, site_id, travel_minutes, start_time, end_time, block_type')
          .in('time_entry_id', pendingIds),
        supabase
          .from('payroll_bookings')
          .select('*')
          .in('time_entry_id', pendingIds),
      ])
    : [{ data: [] }, { data: [] }];

  const bookingsByEntry = new Map<string, PayrollBooking[]>();
  for (const b of allBookings ?? []) {
    if (!b.time_entry_id) continue;
    const list = bookingsByEntry.get(b.time_entry_id) ?? [];
    list.push(b);
    bookingsByEntry.set(b.time_entry_id, list);
  }

  const codeLabels = Object.fromEntries((bookingCodes ?? []).map((c) => [c.code, c.label]));
  const badWeatherDates = (badWeatherDays ?? []).map((d) => d.work_date);
  const pendingDates = [...new Set((pendingEntries ?? []).map((e) => e.work_date))].sort();
  const emptyApprovalQuip = approvalEmptyQuip(todayWorkDate());

  const pendingWithMeta = await Promise.all(
    (pendingEntries ?? []).map(async (entry) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payroll_flags')
        .eq('id', entry.user_id)
        .single();
      return {
        ...entry,
        segments: (allSegments ?? [])
          .filter((segment) => segment.time_entry_id === entry.id && segment.start_time && segment.end_time)
          .map((segment) => ({
            block_type: (segment.block_type ?? 'site_work') as TimeBlockType,
            start_time: segment.start_time!.slice(0, 5),
            end_time: segment.end_time!.slice(0, 5),
            site_id: segment.site_id,
            travel_minutes: segment.travel_minutes,
          })),
        payrollFlags: (profile?.payroll_flags ?? {}) as { lkw_hours?: boolean },
        isBadWeatherDay: isBadWeatherForPreview(entry, badWeatherDates.includes(entry.work_date)),
      };
    }),
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Zeiten zur Freigabe</h1>
          <p>Eingereichte Zeiteinträge aller Mitarbeitenden.</p>
        </div>
        <Link href="/app/zeiten" className="text-button">
          Meine Zeiten →
        </Link>
      </div>

      <section className="panel">
        <h2>Offen ({pendingWithMeta.length})</h2>
        {canMarkBadWeather && (
          <BadWeatherFreigabeControl markedDates={badWeatherDates} suggestedDates={pendingDates} />
        )}
        {pendingEntriesError ? (
          <p className="callout callout-warning" role="alert">
            Zeiteinträge konnten nicht geladen werden: {pendingEntriesError.message}
          </p>
        ) : null}
        {pendingWithMeta.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mitarbeiter</th>
                  <th>Datum</th>
                  <th className="data-table-col--optional">Start</th>
                  <th className="data-table-col--optional">Ende</th>
                  <th>Arbeitszeit</th>
                  <th>Fahrer</th>
                  <th className="data-table-col--optional">KUG</th>
                  <th>Buchungen</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {pendingWithMeta.map((entry) => (
                  <TimeApprovalRow
                    key={entry.id}
                    entry={entry}
                    bookings={bookingsByEntry.get(entry.id) ?? []}
                    codeLabels={codeLabels}
                    bookingCodes={bookingCodes ?? []}
                    canEditBookings={canEditBookings}
                    payrollFlags={entry.payrollFlags}
                    isBadWeatherDay={entry.isBadWeatherDay}
                    tenantConfig={tenantConfigSerialized}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{emptyApprovalQuip}</p>
        )}
      </section>
    </>
  );
}
