import { createClient } from '@/lib/supabase/server';
import { requireTenantMember } from '@/lib/auth/session';
import Link from 'next/link';
import { saveLeaveRequest } from '@/lib/actions/employee';
import { canAccess } from '@/lib/auth/session';
import { LeaveRequestForm } from '@/components/leave/leave-request-form';
import { formatLeaveType } from '@/lib/leave/labels';
import { businessDaysBetween } from '@/lib/utils/time';

export default async function UrlaubPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.urlaub')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: balance }, { data: requests }, { data: holidays }, { data: bridgeDays }] = await Promise.all([
    supabase.from('leave_balances').select('*').eq('user_id', ctx.userId).eq('year', year).maybeSingle(),
    supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false }),
    supabase.from('company_holidays').select('*').gte('end_date', `${year}-01-01`),
    supabase.from('bridge_days').select('*').gte('date', `${year}-01-01`).order('date'),
  ]);

  const remaining = (balance?.entitlement_days ?? 30) + (balance?.carried_over_days ?? 0) - (balance?.used_days ?? 0);
  const canReview = canAccess(ctx, 'urlaub.approve');

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Urlaub & Fehlzeiten</span>
          <h1>Mein Urlaubskonto</h1>
          <p>Resturlaub {year}: {remaining.toFixed(1)} Tage</p>
        </div>
        {canReview && (
          <Link href="/app/urlaub/freigabe" className="text-button">
            Anträge zur Freigabe →
          </Link>
        )}
      </div>

      <div className="metric-grid">
        <article className="metric-card"><span>Anspruch</span><strong>{balance?.entitlement_days ?? 30}</strong></article>
        <article className="metric-card"><span>Vorjahr</span><strong>{balance?.carried_over_days ?? 0}</strong></article>
        <article className="metric-card"><span>Genutzt</span><strong>{balance?.used_days ?? 0}</strong></article>
        <article className="metric-card metric-feature"><span>Rest</span><strong>{remaining.toFixed(1)}</strong></article>
      </div>

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
          {(holidays ?? []).map((h) => <li key={h.id}>{h.title}: {h.start_date} – {h.end_date}</li>)}
          {!holidays?.length && <li>Keine Einträge</li>}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Brückentage</h2>
        <ul className="simple-list">
          {(bridgeDays ?? []).map((b) => <li key={b.id}>{b.title}: {b.date}</li>)}
          {!bridgeDays?.length && <li>Keine Einträge</li>}
        </ul>
      </section>
    </>
  );
}
