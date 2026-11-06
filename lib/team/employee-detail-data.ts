import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchLatestInvitation } from '@/lib/team/employee-invite-service';
import { loadLeaveBalanceContext } from '@/lib/leave/balance';
import { buildBudgetBreakdown } from '@/lib/orders/budget';
import { loadClothingOrderBudgetBreakdown } from '@/lib/orders/load-budget';
import { canAccess } from '@/lib/auth/session';
import type { SessionContext } from '@/lib/auth/session';
import type { EmployeeTabId } from '@/lib/team/detail-tabs';
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

export type EmployeeDetailMode = 'self' | 'admin';

type AssignmentRow = {
  id: string;
  assignment_date: string;
  notes: string | null;
  sites: { name: string } | null;
};

export type EmployeeDetailLoadResult = {
  mode: EmployeeDetailMode;
  member: Profile & { tenant_roles: { name: string; slug: string } | null };
  roleName: string;
  /** Basis-Pfad für Tab- und Monats-Links: `/app/profil` oder `/app/team/[id]` */
  tabBasePath: string;
  targetUserId: string;
  tenantRoles: TenantRole[];
  leaveContext: Awaited<ReturnType<typeof loadLeaveBalanceContext>>;
  leaveRequests: LeaveRequest[];
  /** Kalenderjahr (Übersicht) */
  yearTimeEntries: TimeEntry[];
  /** Ausgewählter Monat (Tab Zeiten) */
  monthTimeEntries: TimeEntry[];
  monthMinutes: number;
  assignments: AssignmentRow[];
  todayAssignment: AssignmentRow | null;
  orders: ClothingOrder[];
  catalogOrders: (CatalogOrder & { catalog_order_items: CatalogOrderItem[] })[];
  orderBudgetBreakdown: ReturnType<typeof buildBudgetBreakdown>;
  employeeOrderBudgetEur: number | null;
  notes: (EmployeeNote & { author?: { first_name: string; last_name: string } | null })[];
  pendingLeaveCount: number;
  invitation: Awaited<ReturnType<typeof fetchLatestInvitation>> | null;
  workAreas: { id: string; name: string; is_active: boolean }[];
};

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

export async function loadEmployeeDetailData(args: {
  supabase: SupabaseClient;
  ctx: SessionContext;
  mode: EmployeeDetailMode;
  /** In Admin-Modus die User-ID aus der URL; im Self-Modus wird `ctx.userId` erzwungen */
  memberIdFromRoute: string | null;
  activeTab: EmployeeTabId;
  month: string;
}): Promise<EmployeeDetailLoadResult | null> {
  const { supabase, ctx, mode, activeTab } = args;
  const month = args.month.match(/^\d{4}-\d{2}$/) ? args.month : new Date().toISOString().slice(0, 7);

  const targetUserId = mode === 'self' ? ctx.userId : (args.memberIdFromRoute ?? '');
  if (!targetUserId) return null;

  const tenantId = ctx.tenant?.id;
  if (!tenantId) return null;

  const budgetYear = new Date().getFullYear();
  const selectedYear = Number(month.slice(0, 4));
  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear + 1}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${month}-01`;
  const monthEnd = nextMonthStart(month);

  const { data: rawMember, error } = await supabase
    .from('profiles')
    .select('*, tenant_roles(name, slug)')
    .eq('id', targetUserId)
    .single();

  if (error || !rawMember || rawMember.tenant_id !== tenantId) {
    return null;
  }

  const member = rawMember as Profile & { tenant_roles: { name: string; slug: string } | null };
  const roleName = member.tenant_roles?.name ?? '—';
  const tabBasePath = mode === 'self' ? '/app/profil' : `/app/team/${targetUserId}`;

  const loadNotesAndInvitation = mode === 'admin';
  const loadAssignments = mode === 'admin';

  const [
    tenantRolesResult,
    leaveContext,
    leaveRequestsResult,
    overviewYearResult,
    monthEntriesResult,
    monthMinuteRowsResult,
    futureAssignmentsResult,
    todayAssignmentResult,
    ordersResult,
    notesRawResult,
    workAreasResult,
  ] = await Promise.all([
    mode === 'admin'
      ? supabase.from('tenant_roles').select('*').order('sort_order')
      : Promise.resolve({ data: [] as TenantRole[] }),
    loadLeaveBalanceContext(supabase, tenantId, targetUserId, selectedYear),
    supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false }),
    supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('work_date', yearStart)
      .lt('work_date', yearEnd)
      .order('work_date', { ascending: false }),
    supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('work_date', monthStart)
      .lt('work_date', monthEnd)
      .order('work_date', { ascending: false }),
    supabase
      .from('time_entries')
      .select('work_minutes')
      .eq('user_id', targetUserId)
      .gte('work_date', monthStart)
      .lt('work_date', monthEnd),
    loadAssignments
      ? supabase
          .from('daily_assignments')
          .select('id, assignment_date, notes, sites(name)')
          .eq('user_id', targetUserId)
          .gte('assignment_date', today)
          .order('assignment_date')
          .limit(20)
      : Promise.resolve({ data: null }),
    supabase
      .from('daily_assignments')
      .select('id, assignment_date, notes, sites(name)')
      .eq('user_id', targetUserId)
      .eq('assignment_date', today)
      .maybeSingle(),
    supabase
      .from('clothing_orders')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false }),
    loadNotesAndInvitation
      ? supabase.from('employee_notes').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as EmployeeNote[] }),
    supabase
      .from('tenant_work_areas')
      .select('id, name, is_active')
      .eq('tenant_id', tenantId)
      .order('sort_order'),
  ]);

  let notes: EmployeeDetailLoadResult['notes'] = [];
  if (loadNotesAndInvitation && notesRawResult.data) {
    const notesRaw = notesRawResult.data;
    const authorIds = [...new Set(notesRaw.map((n) => n.created_by).filter(Boolean))] as string[];
    const { data: authors } = authorIds.length
      ? await supabase.from('profiles').select('id, first_name, last_name').in('id', authorIds)
      : { data: [] as { id: string; first_name: string; last_name: string }[] };
    const authorById = new Map((authors ?? []).map((a) => [a.id, a]));
    notes = notesRaw.map((n) => ({
      ...(n as EmployeeNote),
      author: n.created_by ? authorById.get(n.created_by) ?? null : null,
    }));
  }

  const leaveRequests = (leaveRequestsResult.data ?? []) as LeaveRequest[];
  const yearTimeEntries = (overviewYearResult.data ?? []) as TimeEntry[];
  const monthTimeEntries = (monthEntriesResult.data ?? []) as TimeEntry[];
  const monthMinutes = (monthMinuteRowsResult.data ?? []).reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === 'pending').length;

  const assignments = loadAssignments ? normalizeAssignments(futureAssignmentsResult.data) : [];
  const todayRow = todayAssignmentResult.data;
  const todayAssignment = todayRow ? normalizeAssignment(todayRow as Parameters<typeof normalizeAssignment>[0]) : null;

  const orders = (ordersResult.data ?? []) as ClothingOrder[];

  let catalogOrders: EmployeeDetailLoadResult['catalogOrders'] = [];
  let orderBudgetBreakdown = buildBudgetBreakdown(budgetYear, null, 0);
  let employeeOrderBudgetEur: number | null = null;

  if (activeTab === 'bestellungen' && tenantId) {
    const [catalogRes, budgetRow, breakdown] = await Promise.all([
      supabase
        .from('catalog_orders')
        .select('*, catalog_order_items(*)')
        .eq('tenant_id', tenantId)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),
      supabase
        .from('clothing_order_budgets')
        .select('budget_eur')
        .eq('tenant_id', tenantId)
        .eq('user_id', targetUserId)
        .eq('year', budgetYear)
        .maybeSingle(),
      loadClothingOrderBudgetBreakdown(supabase, tenantId, targetUserId, budgetYear),
    ]);
    catalogOrders = (catalogRes.data ?? []) as (CatalogOrder & { catalog_order_items: CatalogOrderItem[] })[];
    employeeOrderBudgetEur = budgetRow.data?.budget_eur != null ? Number(budgetRow.data.budget_eur) : null;
    orderBudgetBreakdown = breakdown;
  }

  const invitation =
    loadNotesAndInvitation && canAccess(ctx, 'team.view')
      ? await fetchLatestInvitation(createAdminClient(), targetUserId)
      : null;

  return {
    mode,
    member,
    roleName,
    tabBasePath,
    targetUserId,
    tenantRoles: (tenantRolesResult.data ?? []) as TenantRole[],
    leaveContext,
    leaveRequests,
    yearTimeEntries,
    monthTimeEntries,
    monthMinutes,
    assignments,
    todayAssignment,
    orders,
    catalogOrders,
    orderBudgetBreakdown,
    employeeOrderBudgetEur,
    notes,
    pendingLeaveCount,
    invitation,
    workAreas: workAreasResult.data ?? [],
  };
}
