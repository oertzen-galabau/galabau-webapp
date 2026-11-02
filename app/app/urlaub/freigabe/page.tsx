import { createClient } from '@/lib/supabase/server';
import { canAccess, getTenantIdForSession, requireTenantMember } from '@/lib/auth/session';
import { LeaveTabs } from '@/components/leave/leave-tabs';
import { LeaveFreigabeTable } from '@/components/leave/leave-freigabe-table';
import { listPendingLeaveForApproval } from '@/lib/leave/queries';

export default async function UrlaubFreigabePage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'urlaub.approve')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const tenantId = await getTenantIdForSession(ctx);
  if (!tenantId) return <p className="muted">Kein Mandant.</p>;

  const supabase = await createClient();
  const { data: requests, error: loadError } = await listPendingLeaveForApproval(supabase, tenantId);

  const showTeamCalendar = canAccess(ctx, 'urlaub.team_calendar');

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Anträge zur Freigabe</h1>
          <p>Offene Urlaubs- und Fehlzeitanträge aller Mitarbeitenden.</p>
        </div>
      </div>

      {showTeamCalendar && <LeaveTabs activeTab="freigabe" showFreigabe />}

      <section className="panel">
        <h2>Offen ({requests.length})</h2>
        {loadError && <p className="form-error">Anträge konnten nicht geladen werden.</p>}
        {!loadError && requests.length === 0 ? (
          <p className="muted">Keine offenen Anträge.</p>
        ) : (
          <LeaveFreigabeTable requests={requests} currentUserId={ctx.userId} />
        )}
      </section>
    </>
  );
}
