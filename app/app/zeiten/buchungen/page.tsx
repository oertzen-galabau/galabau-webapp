import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';

type BookingRow = {
  user_id: string;
  booking_code: string;
  unit: string;
  total: number;
  first_name: string;
  last_name: string;
  label: string;
};

export default async function BuchungenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.zeiten')) return <p className="muted">Keine Berechtigung.</p>;

  const params = await searchParams;
  const month = params.month ?? new Date().toISOString().slice(0, 7);
  const canViewAll = canAccess(ctx, 'zeiten.view_all');

  const supabase = await createClient();

  let bookingsQuery = supabase
    .from('payroll_bookings')
    .select('user_id, booking_code, unit, quantity, profiles(first_name, last_name)')
    .eq('tenant_id', ctx.tenant!.id)
    .gte('work_date', `${month}-01`)
    .lte('work_date', `${month}-31`);

  if (!canViewAll) {
    bookingsQuery = bookingsQuery.eq('user_id', ctx.userId);
  }

  const [{ data: bookings }, { data: codes }] = await Promise.all([
    bookingsQuery,
    supabase
      .from('payroll_booking_codes')
      .select('code, label')
      .eq('tenant_id', ctx.tenant!.id),
  ]);

  const codeLabels = Object.fromEntries((codes ?? []).map((c) => [c.code, c.label]));

  const aggregated = new Map<string, BookingRow>();
  for (const b of bookings ?? []) {
    const profileRaw = b.profiles;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;
    const key = `${b.user_id}:${b.booking_code}:${b.unit}`;
    const existing = aggregated.get(key);
    const qty = Number(b.quantity);
    if (existing) {
      existing.total += qty;
    } else {
      aggregated.set(key, {
        user_id: b.user_id,
        booking_code: b.booking_code,
        unit: b.unit,
        total: qty,
        first_name: profile?.first_name ?? '—',
        last_name: profile?.last_name ?? '',
        label: codeLabels[b.booking_code] ?? b.booking_code,
      });
    }
  }

  const rows = [...aggregated.values()].sort((a, b) => {
    const nameA = `${a.last_name}${a.first_name}`;
    const nameB = `${b.last_name}${b.first_name}`;
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return a.booking_code.localeCompare(b.booking_code);
  });

  function formatQty(total: number, unit: string) {
    return unit === 'eur' ? `${total.toFixed(2)} €` : `${total.toFixed(2)} Std.`;
  }

  const prevMonth = new Date(`${month}-01`);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const nextMonth = new Date(`${month}-01`);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const prevStr = prevMonth.toISOString().slice(0, 7);
  const nextStr = nextMonth.toISOString().slice(0, 7);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Buchungsübersicht</h1>
          <p>Monat: {month}</p>
        </div>
        <Link href="/app/zeiten" className="text-button">← Zeiten</Link>
      </div>

      <div className="inline-actions" style={{ marginBottom: 16 }}>
        <Link href={`/app/zeiten/buchungen?month=${prevStr}`} className="text-button">
          ← {prevStr}
        </Link>
        <Link href={`/app/zeiten/buchungen?month=${nextStr}`} className="text-button">
          {nextStr} →
        </Link>
      </div>

      <section className="panel">
        <h2>{canViewAll ? 'Alle Mitarbeiter' : 'Meine Buchungen'}</h2>
        {rows.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {canViewAll && <th>Mitarbeiter</th>}
                  <th>Code</th>
                  <th>Bezeichnung</th>
                  <th>Summe</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.user_id}-${row.booking_code}-${row.unit}`}>
                    {canViewAll && (
                      <td>{row.first_name} {row.last_name}</td>
                    )}
                    <td>{row.booking_code}</td>
                    <td>{row.label}</td>
                    <td>{formatQty(row.total, row.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Keine Buchungen für diesen Monat.</p>
        )}
      </section>
    </>
  );
}
