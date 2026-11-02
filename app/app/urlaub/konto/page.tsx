import { createClient } from '@/lib/supabase/server';
import { canAccess, getTenantIdForSession, requireTenantMember } from '@/lib/auth/session';
import { LeaveRequestForm } from '@/components/leave/leave-request-form';
import { LeaveBalanceMetrics } from '@/components/leave/leave-balance-metrics';
import { LeaveTabs } from '@/components/leave/leave-tabs';
import { LeaveRequestsTable } from '@/components/leave/leave-requests-table';
import { loadLeaveBalanceContext } from '@/lib/leave/balance';
import { listMyLeaveRequests } from '@/lib/leave/queries';

export default async function UrlaubKontoPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.urlaub')) return <p className="muted">Keine Berechtigung.</p>;

  const tenantId = await getTenantIdForSession(ctx);
  if (!tenantId) return <p className="muted">Kein Mandant.</p>;

  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [
    { breakdown, companyHolidays, bridgeDays, carryExpiry },
    { data: requests, error: loadError },
  ] = await Promise.all([
    loadLeaveBalanceContext(supabase, tenantId, ctx.userId, year),
    listMyLeaveRequests(supabase, tenantId, ctx.userId),
  ]);

  const canReview = canAccess(ctx, 'urlaub.approve');
  const showTeamCalendar = canAccess(ctx, 'urlaub.team_calendar');

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Mein Urlaubskonto</h1>
          <p>
            Resturlaub {year}: {breakdown.remaining.toFixed(1)} Tage
          </p>
        </div>
      </div>

      {showTeamCalendar && <LeaveTabs activeTab="konto" showFreigabe={canReview} />}

      <LeaveBalanceMetrics breakdown={breakdown} carryExpiry={carryExpiry} layout="grouped" />

      <section className="panel form-panel">
        <h2>Antrag / Fehlzeit erfassen</h2>
        <LeaveRequestForm />
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Meine Anträge</h2>
        {loadError && <p className="form-error">Anträge konnten nicht geladen werden.</p>}
        {!loadError && requests.length === 0 && <p className="muted">Keine Anträge vorhanden.</p>}
        {requests.length > 0 && (
          <LeaveRequestsTable
            requests={requests}
            currentUserId={ctx.userId}
            canApprove={canReview}
          />
        )}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Betriebsurlaub</h2>
        <ul className="simple-list">
          {companyHolidays.map((h) => (
            <li key={h.id}>
              {h.title}: {h.start_date} – {h.end_date}
            </li>
          ))}
          {!companyHolidays.length && <li>Keine Einträge</li>}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Brückentage</h2>
        <ul className="simple-list">
          {bridgeDays.map((b) => (
            <li key={b.id}>
              {b.title}: {b.date}
            </li>
          ))}
          {!bridgeDays.length && <li>Keine Einträge</li>}
        </ul>
      </section>
    </>
  );
}
