import { createClient } from '@/lib/supabase/server';
import { canAccess, getTenantIdForSession, requireTenantMember } from '@/lib/auth/session';
import { LeaveTabs } from '@/components/leave/leave-tabs';
import { updateLeaveStatus } from '@/lib/actions/employee';
import { formatLeaveType } from '@/lib/leave/labels';
import { listPendingLeaveForApproval } from '@/lib/leave/queries';
import { businessDaysBetween } from '@/lib/utils/time';
import { ApproveIconAction, RejectIconAction, TableIconActions } from '@/components/ui/icon-action-button';

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
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mitarbeiter</th>
                  <th className="data-table-col--optional">Art</th>
                  <th>Zeitraum</th>
                  <th className="data-table-col--optional">Tage</th>
                  <th>Notiz</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      {req.profiles?.first_name} {req.profiles?.last_name}
                    </td>
                    <td className="data-table-col--optional">
                      {formatLeaveType(req.leave_type, req.notes)}
                    </td>
                    <td>
                      {req.start_date} – {req.end_date}
                    </td>
                    <td className="data-table-col--optional">
                      {businessDaysBetween(req.start_date, req.end_date)}
                    </td>
                    <td>{req.notes ?? '—'}</td>
                    <td className="data-table-actions">
                      <TableIconActions>
                        <form action={updateLeaveStatus}>
                          <input type="hidden" name="id" value={req.id} />
                          <input type="hidden" name="status" value="approved" />
                          <ApproveIconAction type="submit" />
                        </form>
                        <form action={updateLeaveStatus}>
                          <input type="hidden" name="id" value={req.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <RejectIconAction type="submit" />
                        </form>
                      </TableIconActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
