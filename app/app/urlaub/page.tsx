import { createClient } from '@/lib/supabase/server';
import { requireTenantMember } from '@/lib/auth/session';
import Link from 'next/link';
import { saveLeaveRequest } from '@/lib/actions/employee';
import { canAccess } from '@/lib/auth/session';
import { LeaveRequestForm } from '@/components/leave/leave-request-form';
import { LeaveBalanceMetrics } from '@/components/leave/leave-balance-metrics';
import { formatLeaveType } from '@/lib/leave/labels';
import { loadLeaveBalanceContext } from '@/lib/leave/balance';
import { businessDaysBetween } from '@/lib/utils/time';

export default async function UrlaubPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.urlaub')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const year = new Date().getFullYear();
  const tenantId = ctx.tenant!.id;

  const [{ breakdown, companyHolidays, bridgeDays }, { data: requests }] = await Promise.all([
    loadLeaveBalanceContext(supabase, tenantId, ctx.userId, year),
    supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false }),
  ]);

  const canReview = canAccess(ctx, 'urlaub.approve');

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Urlaub & Fehlzeiten</span>
          <h1>Mein Urlaubskonto</h1>
          <p>Resturlaub {year}: {breakdown.remaining.toFixed(1)} Tage</p>
        </div>
        {canReview && (
          <Link href="/app/urlaub/freigabe" className="text-button">
            Anträge zur Freigabe →
          </Link>
        )}
      </div>

      <LeaveBalanceMetrics breakdown={breakdown} />

      <section className="panel form-panel">
        <h2>Antrag / Fehlzeit erfassen</h2>
        <LeaveRequestForm action={saveLeaveRequest} />
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Meine Anträge</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th className="data-table-col--optional">Art</th><th>Zeitraum</th><th className="data-table-col--optional">Tage</th><th>Status</th></tr></thead>
            <tbody>
              {(requests ?? []).map((req) => (
                <tr key={req.id}>
                  <td className="data-table-col--optional">{formatLeaveType(req.leave_type, req.notes)}</td>
                  <td>{req.start_date} – {req.end_date}</td>
                  <td className="data-table-col--optional">{businessDaysBetween(req.start_date, req.end_date)}</td>
                <td><span className={`status-badge ${req.status === 'approved' ? 'active' : req.status === 'rejected' ? 'travel' : ''}`}>{req.status}</span></td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Betriebsurlaub</h2>
        <ul className="simple-list">
          {companyHolidays.map((h) => (
            <li key={h.id}>{h.title}: {h.start_date} – {h.end_date}</li>
          ))}
          {!companyHolidays.length && <li>Keine Einträge</li>}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Brückentage</h2>
        <ul className="simple-list">
          {bridgeDays.map((b) => <li key={b.id}>{b.title}: {b.date}</li>)}
          {!bridgeDays.length && <li>Keine Einträge</li>}
        </ul>
      </section>
    </>
  );
}
