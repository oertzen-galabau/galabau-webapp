import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { fetchLatestInvitation } from '@/lib/team/employee-invite-service';
import { EmployeeDetailHeader } from '@/components/team/employee-detail-header';
import { EmployeeDetailTabs } from '@/components/team/employee-detail-tabs';
import { EmployeeTabPanel } from '@/components/team/employee-tab-panels';
import { isEmployeeTab, visibleEmployeeTabs, type EmployeeTabId } from '@/lib/team/detail-tabs';
import { loadLeaveBalanceContext } from '@/lib/leave/balance';
import { buildBudgetBreakdown } from '@/lib/orders/budget';
import { loadClothingOrderBudgetBreakdown } from '@/lib/orders/load-budget';
import type {
  CatalogOrder,
  CatalogOrderItem,
  ClothingOrder,
  EmployeeNote,
  LeaveRequest,
  Profile,
  TenantRole,
  TimeEntry,
} from '@/lib/types/database';

type AssignmentRow = {
  id: string;
  assignment_date: string;
  notes: string | null;
  sites: { name: string } | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
};

export default async function EmployeeDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab: tabParam, month: monthParam } = await searchParams;

  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'team.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const tabs = visibleEmployeeTabs(ctx.permissions, ctx.isSuperadminBypass);
  if (tabs.length === 0) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const activeTab: EmployeeTabId = isEmployeeTab(tabParam) && tabs.some((t) => t.id === tabParam)
    ? tabParam
    : tabs[0].id;

  const supabase = await createClient();
  const year = new Date().getFullYear();
  const month = monthParam?.match(/^\d{4}-\d{2}$/) ? monthParam : new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${month}-01`;
  const monthEnd = nextMonthStart(month);

  const { data: rawMember, error } = await supabase
    .from('profiles')
    .select('*, tenant_roles(name, slug)')
    .eq('id', id)
    .single();

  if (error || !rawMember || rawMember.tenant_id !== ctx.tenant?.id) {
    notFound();
  }

  const member = rawMember as Profile & { tenant_roles: { name: string; slug: string } | null };
  const roleName = member.tenant_roles?.name ?? '—';

  const [
    { data: tenantRoles },
    leaveContext,
    { data: leaveRequests },
    { data: overviewTimeEntries },
    { data: monthTimeEntries },
    { data: monthMinuteRows },
    { data: assignments },
    { data: todayAssignment },
    { data: orders },
    { data: notesRaw },
    { data: workAreas },
  ] = await Promise.all([
    supabase.from('tenant_roles').select('*').order('sort_order'),
    loadLeaveBalanceContext(supabase, ctx.tenant!.id, id, year),
    supabase.from('leave_requests').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    supabase.from('time_entries').select('*').eq('user_id', id).order('work_date', { ascending: false }).limit(5),
    supabase.from('time_entries').select('*').eq('user_id', id).gte('work_date', monthStart).lt('work_date', monthEnd).order('work_date', { ascending: false }),
    supabase.from('time_entries').select('work_minutes').eq('user_id', id).gte('work_date', monthStart).lt('work_date', monthEnd),
    supabase.from('daily_assignments').select('id, assignment_date, notes, sites(name)').eq('user_id', id).gte('assignment_date', today).order('assignment_date').limit(20),
    supabase.from('daily_assignments').select('id, assignment_date, notes, sites(name)').eq('user_id', id).eq('assignment_date', today).maybeSingle(),
    supabase.from('clothing_orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    supabase.from('employee_notes').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    supabase
      .from('tenant_work_areas')
      .select('id, name, is_active')
      .eq('tenant_id', ctx.tenant!.id)
      .order('sort_order'),
  ]);

  const authorIds = [...new Set((notesRaw ?? []).map((n) => n.created_by).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', authorIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));

  const timeEntries = (activeTab === 'zeiten' ? monthTimeEntries : overviewTimeEntries) ?? [] as TimeEntry[];
  const monthMinutes = (monthMinuteRows ?? []).reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const pendingLeaveCount = (leaveRequests ?? []).filter((r) => r.status === 'pending').length;

  const notes = (notesRaw ?? []).map((n) => ({
    ...(n as EmployeeNote),
    author: n.created_by ? authorById.get(n.created_by) ?? null : null,
  }));

  const invitation = canAccess(ctx, 'team.view')
    ? await fetchLatestInvitation(createAdminClient(), id)
    : null;

  let catalogOrders: (CatalogOrder & { catalog_order_items: CatalogOrderItem[] })[] = [];
  let orderBudgetBreakdown = buildBudgetBreakdown(year, null, 0);
  let employeeOrderBudgetEur: number | null = null;

  if (activeTab === 'bestellungen' && ctx.tenant?.id) {
    const tenantId = ctx.tenant.id;
    const [catalogRes, budgetRow, breakdown] = await Promise.all([
      supabase
        .from('catalog_orders')
        .select('*, catalog_order_items(*)')
        .eq('tenant_id', tenantId)
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('clothing_order_budgets')
        .select('budget_eur')
        .eq('tenant_id', tenantId)
        .eq('user_id', id)
        .eq('year', year)
        .maybeSingle(),
      loadClothingOrderBudgetBreakdown(supabase, tenantId, id, year),
    ]);
    catalogOrders = (catalogRes.data ?? []) as (CatalogOrder & { catalog_order_items: CatalogOrderItem[] })[];
    employeeOrderBudgetEur = budgetRow.data?.budget_eur != null ? Number(budgetRow.data.budget_eur) : null;
    orderBudgetBreakdown = breakdown;
  }

  return (
    <>
      <EmployeeDetailHeader member={member} roleName={roleName} />
      <EmployeeDetailTabs
        employeeId={id}
        tabs={tabs}
        activeTab={activeTab}
        month={activeTab === 'zeiten' ? month : undefined}
      />
      <EmployeeTabPanel
        tab={activeTab}
        member={member}
        roleName={roleName}
        tenantRoles={(tenantRoles ?? []) as TenantRole[]}
        ctx={{
          userId: ctx.userId,
          permissions: ctx.permissions,
          isSuperadminBypass: ctx.isSuperadminBypass,
        }}
        year={year}
        month={month}
        balance={leaveContext.balance}
        leaveBreakdown={leaveContext.breakdown}
        carriedOverSource={leaveContext.carriedOverSource}
        carryExpiry={leaveContext.carryExpiry}
        leaveRequests={(leaveRequests ?? []) as LeaveRequest[]}
        timeEntries={timeEntries as TimeEntry[]}
        assignments={normalizeAssignments(assignments)}
        orders={(orders ?? []) as ClothingOrder[]}
        catalogOrders={catalogOrders}
        orderBudgetBreakdown={orderBudgetBreakdown}
        employeeOrderBudgetEur={employeeOrderBudgetEur}
        notes={notes}
        monthMinutes={monthMinutes}
        pendingLeaveCount={pendingLeaveCount}
        todayAssignment={todayAssignment ? normalizeAssignment(todayAssignment) : null}
        invitation={invitation}
        workAreas={workAreas ?? []}
      />
    </>
  );
}

function nextMonthStart(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 10);
}

function normalizeAssignment(row: {
  id: string;
  assignment_date: string;
  notes: string | null;
  sites: { name: string } | { name: string }[] | null;
}): AssignmentRow {
  const site = Array.isArray(row.sites) ? row.sites[0] ?? null : row.sites;
  return { ...row, sites: site };
}

function normalizeAssignments(rows: unknown): AssignmentRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeAssignment(row as Parameters<typeof normalizeAssignment>[0]));
}
