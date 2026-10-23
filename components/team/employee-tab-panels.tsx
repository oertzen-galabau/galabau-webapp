import Link from 'next/link';
import type { PermissionKey } from '@/lib/auth/permissions';
import {
  updateLeaveEntitlement,
  recalculateLeaveCarryFromPreviousYear,
  updateMemberRole,
  setMemberActive,
  sendEmployeePasswordReset,
  saveEmployeeNote,
} from '@/lib/actions/admin';
import { formatCarryExpiryLabel } from '@/lib/leave/carry-over';
import { updateLeaveStatus } from '@/lib/actions/employee';
import { updateEmployeeClothingOrderBudget } from '@/lib/actions/orders';
import { canAccess } from '@/lib/auth/session';
import { LeaveBalanceMetrics } from '@/components/leave/leave-balance-metrics';
import { formatLeaveType } from '@/lib/leave/labels';
import type { LeaveBalanceBreakdown, LeaveBalanceRow } from '@/lib/leave/balance';
import type { BudgetBreakdown } from '@/lib/orders/budget';
import { OrderBudgetMetrics } from '@/components/orders/order-budget-metrics';
import { formatOrderEuro, ORDER_STATUS_LABELS } from '@/lib/orders/labels';
import type { EmployeeTabId } from '@/lib/team/detail-tabs';
import type {
  ClothingOrder,
  CatalogOrder,
  CatalogOrderItem,
  EmployeeInvitation,
  EmployeeNote,
  LeaveRequest,
  Profile,
  TenantRole,
  TenantWorkArea,
  TimeEntry,
} from '@/lib/types/database';
import { EmployeeInvitationPanel } from '@/components/team/employee-invitation-panel';
import {
  getMemberAccessStatus,
  memberAccessStatusLabel,
} from '@/lib/team/member-access-status';
import { businessDaysBetween, formatMinutes } from '@/lib/utils/time';
import { AppSelect } from '@/components/ui/app-select';
import { EmployeeStammdatenForm } from '@/components/team/employee-stammdaten-form';
import { ApproveIconAction, RejectIconAction, TableIconActions } from '@/components/ui/icon-action-button';

type PermCtx = {
  permissions: Set<PermissionKey>;
  isSuperadminBypass: boolean;
};

type AssignmentRow = {
  id: string;
  assignment_date: string;
  notes: string | null;
  sites: { name: string } | null;
};

type Props = {
  tab: EmployeeTabId;
  member: Profile;
  roleName: string;
  tenantRoles: TenantRole[];
  ctx: PermCtx & { userId: string };
  year: number;
  month: string;
  balance: LeaveBalanceRow | null;
  leaveBreakdown: LeaveBalanceBreakdown;
  carriedOverSource: 'manual' | 'automatic';
  carryExpiry: { month: number; day: number } | null;
  leaveRequests: LeaveRequest[];
  timeEntries: TimeEntry[];
  assignments: AssignmentRow[];
  orders: ClothingOrder[];
  catalogOrders: (CatalogOrder & { catalog_order_items: CatalogOrderItem[] })[];
  orderBudgetBreakdown: BudgetBreakdown;
  employeeOrderBudgetEur: number | null;
  notes: (EmployeeNote & { author?: { first_name: string; last_name: string } | null })[];
  monthMinutes: number;
  pendingLeaveCount: number;
  todayAssignment: AssignmentRow | null;
  invitation: EmployeeInvitation | null;
  workAreas: Pick<TenantWorkArea, 'id' | 'name' | 'is_active'>[];
};

function can(ctx: PermCtx, key: PermissionKey) {
  return canAccess(ctx, key);
}

const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

export function EmployeeTabPanel(props: Props) {
  switch (props.tab) {
    case 'overview':
      return <OverviewTab {...props} />;
    case 'stammdaten':
      return <StammdatenTab {...props} />;
    case 'rolle':
      return <RolleTab {...props} />;
    case 'urlaub':
      return <UrlaubTab {...props} />;
    case 'zeiten':
      return <ZeitenTab {...props} />;
    case 'einsatz':
      return <EinsatzTab {...props} />;
    case 'bestellungen':
      return <BestellungenTab {...props} />;
    case 'notizen':
      return <NotizenTab {...props} />;
    default:
      return null;
  }
}

function OverviewTab({
  member,
  ctx,
  year,
  monthMinutes,
  pendingLeaveCount,
  todayAssignment,
  timeEntries,
  leaveRequests,
  leaveBreakdown,
}: Props) {
  return (
    <section className="panel employee-section">
      <div className="employee-overview-grid metric-grid">
        <article className="metric-card">
          <span>Resturlaub {year}</span>
          <strong>{leaveBreakdown.remaining.toFixed(1)}</strong>
        </article>
        <article className="metric-card">
          <span>Stunden (Monat)</span>
          <strong>{formatMinutes(monthMinutes)}</strong>
        </article>
        <article className="metric-card">
          <span>Offene Anträge</span>
          <strong>{pendingLeaveCount}</strong>
        </article>
        <article className="metric-card metric-feature">
          <span>Heutiger Einsatz</span>
          <strong>{todayAssignment?.sites?.name ?? '—'}</strong>
        </article>
      </div>

      <div className="employee-quick-actions">
        <h2>Schnellaktionen</h2>
        <div className="inline-actions employee-quick-actions-buttons">
          <Link
            href={`/app/team/${member.id}?tab=stammdaten`}
            className="secondary-button secondary-button--compact"
          >
            Stammdaten
          </Link>
          {can(ctx, 'team.assign_role') && (
            <Link
              href={`/app/team/${member.id}?tab=rolle`}
              className="secondary-button secondary-button--compact"
            >
              Rolle ändern
            </Link>
          )}
          {can(ctx, 'team.password_reset') && (
            <form action={sendEmployeePasswordReset} className="employee-quick-actions-form">
              <input type="hidden" name="user_id" value={member.id} />
              <button type="submit" className="secondary-button secondary-button--compact">
                Passwort-Reset senden
              </button>
            </form>
          )}
          {can(ctx, 'team.deactivate') && member.id !== ctx.userId && (
            <form action={setMemberActive} className="employee-quick-actions-form">
              <input type="hidden" name="user_id" value={member.id} />
              <input type="hidden" name="is_active" value={member.is_active ? 'false' : 'true'} />
              <button type="submit" className="secondary-button secondary-button--compact">
                {member.is_active ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="employee-feed-grid">
        <div>
          <h2>Letzte Zeiteinträge</h2>
          {timeEntries.length === 0 && <p className="muted">Keine Einträge.</p>}
          <ul className="simple-list">
            {timeEntries.slice(0, 5).map((e) => (
              <li key={e.id}>{e.work_date} · {formatMinutes(e.work_minutes ?? 0)} Std.</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Letzte Urlaubsanträge</h2>
          {leaveRequests.length === 0 && <p className="muted">Keine Anträge.</p>}
          <ul className="simple-list">
            {leaveRequests.slice(0, 3).map((r) => (
              <li key={r.id}>
                {formatLeaveType(r.leave_type, r.notes)} · {r.start_date} – {r.end_date} · {LEAVE_STATUS_LABELS[r.status]}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StammdatenTab({ member, ctx, workAreas }: Props) {
  const editable = can(ctx, 'team.edit_profile');

  return (
    <section className="panel form-panel employee-section">
      <h2>Stammdaten</h2>
      {!editable && <p className="muted">Nur Lesezugriff.</p>}
      <EmployeeStammdatenForm member={member} editable={editable} workAreas={workAreas} />
    </section>
  );
}

function RolleTab({ member, roleName, tenantRoles, ctx, invitation }: Props) {
  const isSelf = member.id === ctx.userId;
  const canAssign = can(ctx, 'team.assign_role');
  const canDeactivate = can(ctx, 'team.deactivate');
  const canReset = can(ctx, 'team.password_reset');
  const canViewRoles = can(ctx, 'roles.manage');

  return (
    <section className="panel form-panel form-panel--compact employee-section employee-access-panel">
      <h2>Rolle & Zugriff</h2>
      <p className="employee-access-lead muted">
        Aktuelle Rolle: <strong>{roleName}</strong>
      </p>

      {canAssign && (
        <form action={updateMemberRole} className="input-form employee-role-form">
          <input type="hidden" name="user_id" value={member.id} />
          <div className="employee-role-assign-row">
            <label>
              Mandanten-Rolle
              <AppSelect
                name="tenant_role_id"
                defaultValue={member.tenant_role_id ?? ''}
                disabled={isSelf}
                allowEmpty={false}
                required
                options={(tenantRoles ?? []).map((role) => ({ value: role.id, label: role.name }))}
              />
            </label>
            {!isSelf && (
              <button type="submit" className="primary-button primary-button--compact">
                Rolle speichern
              </button>
            )}
          </div>
          {isSelf && <p className="muted employee-access-hint">Eigene Rolle kann nicht geändert werden.</p>}
        </form>
      )}

      {canViewRoles && member.tenant_role_id && (
        <p className="employee-access-link-row">
          <Link href={`/app/rollen?role=${member.tenant_role_id}`} className="text-button">
            Berechtigungen dieser Rolle anzeigen
          </Link>
        </p>
      )}

      <div className="employee-section-divider employee-section-divider--compact" />

      <div className="employee-access-block">
        <h3>Status & Zugang</h3>
        <div className="employee-access-status-row">
          <p className="employee-access-status-label">
            Aktuell:{' '}
            <strong>
              {memberAccessStatusLabel(getMemberAccessStatus({
                is_active: member.is_active,
                must_change_password: member.must_change_password,
              }))}
            </strong>
          </p>
          <div className="inline-actions employee-access-actions">
            {canDeactivate && !isSelf && (
              <form action={setMemberActive}>
                <input type="hidden" name="user_id" value={member.id} />
                <input type="hidden" name="is_active" value={member.is_active ? 'false' : 'true'} />
                <button type="submit" className="secondary-button secondary-button--compact">
                  {member.is_active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </form>
            )}
            {canReset && (
              <form action={sendEmployeePasswordReset}>
                <input type="hidden" name="user_id" value={member.id} />
                <button type="submit" className="secondary-button secondary-button--compact">
                  Passwort-Reset senden
                </button>
              </form>
            )}
          </div>
        </div>

        <EmployeeInvitationPanel
          memberId={member.id}
          memberName={`${member.first_name} ${member.last_name}`}
          mustChangePassword={member.must_change_password ?? false}
          invitation={invitation}
          canManageInvites={can(ctx, 'team.manage_invites')}
        />
      </div>
    </section>
  );
}

function UrlaubTab({
  member,
  ctx,
  year,
  balance,
  leaveRequests,
  leaveBreakdown,
  carriedOverSource,
  carryExpiry,
}: Props) {
  const canEditEntitlement = can(ctx, 'team.leave_entitlement');
  const canApprove = can(ctx, 'urlaub.approve');
  const totalGross =
    leaveBreakdown.entitlementDays + Number(balance?.carried_over_days ?? 0);

  return (
    <>
      <LeaveBalanceMetrics
        breakdown={leaveBreakdown}
        carryExpiry={carryExpiry}
        layout="grouped"
      />

      {canEditEntitlement && (
        <section className="panel form-panel form-panel--compact employee-section leave-entitlement-panel">
          <h2>Urlaubsanspruch {year}</h2>
          <form
            id={`leave-entitlement-${member.id}-${year}`}
            action={updateLeaveEntitlement}
            className="input-form leave-entitlement-form"
          >
            <input type="hidden" name="user_id" value={member.id} />
            <input type="hidden" name="year" value={year} />
            <div className="input-form-core input-form-core--split">
              <label>
                Jahresanspruch (Tage)
                <input
                  type="number"
                  name="entitlement_days"
                  min={0}
                  step={0.5}
                  defaultValue={balance?.entitlement_days ?? 30}
                />
              </label>
              <label>
                Resturlaub Vorjahr (Tage)
                <input
                  type="number"
                  name="carried_over_days"
                  min={0}
                  step={0.5}
                  defaultValue={balance?.carried_over_days ?? 0}
                />
              </label>
            </div>
            <p className="muted leave-entitlement-hint">
              {carriedOverSource === 'manual'
                ? 'Resturlaub manuell gesetzt.'
                : `Resturlaub automatisch aus ${year - 1} übernommen.`}
              {carryExpiry && (
                <>
                  {' '}
                  {leaveBreakdown.beforeCarryExpiry
                    ? `Verfällt am ${formatCarryExpiryLabel(carryExpiry)}.`
                    : leaveBreakdown.forfeitedCarry > 0
                      ? `${leaveBreakdown.forfeitedCarry.toFixed(1)} Tag(e) Resturlaub verfallen.`
                      : null}
                </>
              )}
            </p>
          </form>
          <div className="leave-entitlement-footer">
            <form action={recalculateLeaveCarryFromPreviousYear} className="leave-recalc-form">
              <input type="hidden" name="user_id" value={member.id} />
              <input type="hidden" name="year" value={year} />
              <button type="submit" className="text-button">
                Resturlaub aus {year - 1} neu berechnen
              </button>
            </form>
            <p className="leave-entitlement-total">
              Gesamt verfügbar (brutto): <strong>{totalGross.toFixed(1)}</strong> Tage
            </p>
            <div className="input-form-actions">
              <button
                type="submit"
                form={`leave-entitlement-${member.id}-${year}`}
                className="primary-button primary-button--compact"
              >
                Speichern
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel employee-section">
        <h2>Anträge</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Art</th><th>Zeitraum</th><th>Tage</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {leaveRequests.map((req) => (
                <tr key={req.id}>
                  <td>{formatLeaveType(req.leave_type, req.notes)}</td>
                  <td>{req.start_date} – {req.end_date}</td>
                  <td>{businessDaysBetween(req.start_date, req.end_date)}</td>
                  <td>
                    <span className={`status-badge ${req.status === 'approved' ? 'active' : req.status === 'rejected' ? 'travel' : ''}`}>
                      {LEAVE_STATUS_LABELS[req.status]}
                    </span>
                  </td>
                  <td className="data-table-actions">
                    {canApprove && req.status === 'pending' && (
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leaveRequests.length === 0 && <p className="muted">Keine Anträge vorhanden.</p>}
      </section>
    </>
  );
}

function ZeitenTab({ member, month, timeEntries, monthMinutes }: Props) {
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  return (
    <section className="panel employee-section">
      <div className="employee-month-nav">
        <Link href={`/app/team/${member.id}?tab=zeiten&month=${prevMonth}`} className="text-button">← Vorheriger Monat</Link>
        <strong>{formatMonthLabel(month)}</strong>
        <Link href={`/app/team/${member.id}?tab=zeiten&month=${nextMonth}`} className="text-button">Nächster Monat →</Link>
      </div>
      <p className="muted">Summe: {formatMinutes(monthMinutes)} Std.</p>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Datum</th><th>Start</th><th>Ende</th><th>Arbeitszeit</th></tr>
          </thead>
          <tbody>
            {timeEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.work_date}</td>
                <td>{entry.start_time?.slice(0, 5) ?? '—'}</td>
                <td>{entry.end_time?.slice(0, 5) ?? '—'}</td>
                <td>{formatMinutes(entry.work_minutes ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {timeEntries.length === 0 && <p className="muted">Keine Zeiteinträge in diesem Monat.</p>}
    </section>
  );
}

function EinsatzTab({ assignments }: Props) {
  return (
    <section className="panel employee-section">
      <h2>Einsätze & Baustellen</h2>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Datum</th><th>Baustelle</th><th>Notiz</th></tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.assignment_date}</td>
                <td>{a.sites?.name ?? '—'}</td>
                <td>{a.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assignments.length === 0 && <p className="muted">Keine Einsätze geplant.</p>}
    </section>
  );
}

function BestellungenTab({
  member,
  ctx,
  year,
  orders,
  catalogOrders,
  orderBudgetBreakdown,
  employeeOrderBudgetEur,
}: Props) {
  const canEditBudget = can(ctx, 'orders.manage_budget');

  return (
    <>
      <OrderBudgetMetrics breakdown={orderBudgetBreakdown} />

      {canEditBudget && (
        <section className="panel form-panel employee-section">
          <h2>Bestellbudget {year}</h2>
          <form action={updateEmployeeClothingOrderBudget} className="input-form">
            <input type="hidden" name="user_id" value={member.id} />
            <input type="hidden" name="year" value={year} />
            <div className="input-form-core">
              <label>
                Budget (EUR)
                <input
                  type="number"
                  name="budget_eur"
                  min={0}
                  step={0.01}
                  defaultValue={employeeOrderBudgetEur ?? orderBudgetBreakdown.budgetEur ?? 0}
                />
              </label>
            </div>
            <div className="input-form-actions">
              <button type="submit" className="primary-button primary-button--compact">Speichern</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel employee-section">
        <h2>Katalog-Bestellungen</h2>
        {catalogOrders.length === 0 && <p className="muted">Keine Bestellungen.</p>}
        {catalogOrders.map((order) => (
          <details key={order.id} style={{ marginBottom: 8 }}>
            <summary>
              {new Date(order.created_at).toLocaleDateString('de-DE')}
              {' · '}
              {formatOrderEuro(order.total_eur)}
              {' · '}
              {ORDER_STATUS_LABELS[order.status]}
            </summary>
            <ul className="simple-list">
              {order.catalog_order_items.map((line) => (
                <li key={line.id}>
                  {line.clothing_style}, Gr. {line.size}, {line.quantity}×
                  {line.name_print ? ` · Namensdruck: ${line.name_print}` : ''}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      {orders.length > 0 && (
        <section className="panel employee-section">
          <h2>Ältere Bestellungen</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Datum</th><th>Artikel</th><th>Größe</th><th>Menge</th><th>Status</th></tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{new Date(order.created_at).toLocaleDateString('de-DE')}</td>
                    <td>{order.item_type}</td>
                    <td>{order.size}</td>
                    <td>{order.quantity}</td>
                    <td>{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function NotizenTab({ member, ctx, notes }: Props) {
  const canWrite = can(ctx, 'team.notes');

  return (
    <>
      {canWrite && (
        <section className="panel form-panel employee-section">
          <h2>Neue Notiz</h2>
          <form action={saveEmployeeNote} className="input-form">
            <input type="hidden" name="user_id" value={member.id} />
            <div className="input-form-core">
              <label className="input-form-span-full">Notiz<textarea name="content" rows={4} required placeholder="Interne Notiz zum Mitarbeiter…" /></label>
            </div>
            <div className="input-form-actions">
              <button type="submit" className="primary-button primary-button--compact">Speichern</button>
            </div>
          </form>
        </section>
      )}
      <section className="panel employee-section">
        <h2>Notizen</h2>
        <ul className="employee-notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <p>{note.content}</p>
              <small>
                {note.author ? `${note.author.first_name} ${note.author.last_name}` : 'Unbekannt'}
                {' · '}
                {new Date(note.created_at).toLocaleString('de-DE')}
              </small>
            </li>
          ))}
        </ul>
        {notes.length === 0 && <p className="muted">Noch keine Notizen.</p>}
      </section>
    </>
  );
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}
