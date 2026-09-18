import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { saveTimeEntry, resubmitTimeEntry } from '@/lib/actions/employee';
import { TimeEntryFormFields } from '@/components/time-tracking/time-entry-form-fields';
import { TimeEntryOverviewRow } from '@/components/time-tracking/time-entry-overview-row';
import { BadWeatherSection } from '@/components/payroll/bad-weather-section';
import { TimeApprovalRow } from '@/components/payroll/time-approval-row';
import { minEditableWorkDate } from '@/lib/time-tracking/entry-editable';
import { approvalEmptyQuip } from '@/lib/time-tracking/approval-empty-quips';
import { todayWorkDate } from '@/lib/time-tracking/work-day';
import { formatMinutes } from '@/lib/utils/time';
import { isBadWeatherForPreview } from '@/lib/payroll/bad-weather-entry';
import { loadTenantPayrollConfig, serializeTenantConfig } from '@/lib/payroll/tenant-rules';
import type { PayrollBooking, TimeEntry } from '@/lib/types/database';

export default async function ZeitenPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.zeiten')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const month = new Date().toISOString().slice(0, 7);
  const canApprove = canAccess(ctx, 'zeiten.approve');
  const canEditBookings = canAccess(ctx, 'zeiten.bookings.edit');
  const canMarkBadWeather = canAccess(ctx, 'zeiten.bad_weather.mark');

  const tenantConfigSerialized = serializeTenantConfig(
    await loadTenantPayrollConfig(supabase, ctx.tenant!.id),
  );

  const [
    { data: entries },
    { data: rejectedEntries },
    { data: pendingEntries },
    { data: sites },
    { data: bookingCodes },
    { data: badWeatherDays },
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
    canApprove
      ? supabase
          .from('time_entries')
          .select('*, sites(name), profiles(first_name, last_name)')
          .eq('approval_status', 'pending')
          .order('submitted_at', { ascending: true })
      : Promise.resolve({ data: [] as TimeEntry[] }),
    supabase
      .from('sites')
      .select('id, name, default_travel_minutes')
      .eq('is_active', true),
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
          .gte('work_date', `${month}-01`)
      : Promise.resolve({ data: [] as { work_date: string }[] }),
  ]);

  const pendingIds = (pendingEntries ?? []).map((e) => e.id);
  const entryIds = (entries ?? []).map((e) => e.id);
  const allEntryIds = [...new Set([...pendingIds, ...entryIds])];

  const [{ data: allSegments }, { data: allBookings }] = allEntryIds.length > 0
    ? await Promise.all([
        supabase
          .from('time_entry_segments')
          .select('time_entry_id, site_id, travel_minutes')
          .in('time_entry_id', allEntryIds),
        supabase
          .from('payroll_bookings')
          .select('*')
          .in('time_entry_id', allEntryIds),
      ])
    : [{ data: [] }, { data: [] }];

  const segmentsByEntry = new Map<string, { site_id: string; travel_minutes: number }[]>();
  for (const seg of allSegments ?? []) {
    const list = segmentsByEntry.get(seg.time_entry_id) ?? [];
    list.push({ site_id: seg.site_id, travel_minutes: seg.travel_minutes });
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
  const badWeatherDates = (badWeatherDays ?? []).map((d) => d.work_date);

  const approvedMinutes = (entries ?? [])
    .filter((e) => e.approval_status === 'approved')
    .reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const today = todayWorkDate();
  const emptyApprovalQuip = approvalEmptyQuip(today);
  const editableFrom = minEditableWorkDate(today);

  const pendingWithMeta = await Promise.all(
    (pendingEntries ?? []).map(async (entry) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payroll_flags')
        .eq('id', entry.user_id)
        .single();
      return {
        ...entry,
        segments: segmentsByEntry.get(entry.id) ?? [],
        payrollFlags: (profile?.payroll_flags ?? {}) as { lkw_hours?: boolean },
        isBadWeatherDay: isBadWeatherForPreview(
          entry,
          badWeatherDates.includes(entry.work_date),
        ),
      };
    }),
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Arbeitszeiterfassung</span>
          <h1>Meine Zeiten</h1>
          <p>
            Genehmigte Stunden im Monat: {formatMinutes(approvedMinutes)} Std.
            {' '}Buchungsvorschau — finale Lohnbuchungen entstehen nach Freigabe durch das Büro.
          </p>
        </div>
        <Link href="/app/zeiten/buchungen" className="text-button">
          Buchungsübersicht →
        </Link>
      </div>

      <BadWeatherSection markedDates={badWeatherDates} canMark={canMarkBadWeather} />

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
                  sites={sites ?? []}
                  entry={entry}
                  initialSegments={(segmentsByEntry.get(entry.id) ?? []).map((s) => ({
                    siteId: s.site_id,
                    travelMinutes: s.travel_minutes,
                  }))}
                  submitLabel="Erneut einreichen"
                  compact
                />
              </form>
            </article>
          ))}
        </section>
      )}

      {canApprove && (
        <section className="panel" id="freigabe" style={{ marginBottom: 16 }}>
          <h2>Zeiten zur Freigabe</h2>
          {(pendingEntries ?? []).length > 0 ? (
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
      )}

      <section className="panel form-panel">
        <h2>Neuer Zeiteintrag</h2>
        <form action={saveTimeEntry} className="input-form">
          <TimeEntryFormFields sites={sites ?? []} submitLabel="Speichern" compact />
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Tages- und Monatsübersicht</h2>
        <p className="muted">
          Eigene Einträge bearbeiten oder löschen: nur wenn noch nicht freigegeben und vom{' '}
          {editableFrom} bis heute.
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
                  sites={sites ?? []}
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
