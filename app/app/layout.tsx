import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TenantShell } from '@/components/app-shell/tenant-shell';
import { GpsProvider } from '@/components/gps/gps-provider';
import { getPendingTimeApprovalCount, getUnreadMessageCount } from '@/lib/actions/employee';
import { getPendingOrderCount } from '@/lib/actions/orders';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { getTenantBySlug, tenantThemeStyle } from '@/lib/tenant/resolve';
import { getTenantRoles } from '@/lib/tenant/roles';
import { createClient } from '@/lib/supabase/server';
import { userHasForemanDutyOnDate } from '@/lib/schedule/foreman-daily-report';
import { todayWorkDate } from '@/lib/time-tracking/work-day';
import { loadTodayWorkSession } from '@/lib/time-tracking/today-work-session';
import { buildTodayScheduleContext } from '@/lib/time-tracking/today-schedule-context';
import type { TimeEntryInterval } from '@/lib/types/database';
import type { TodayScheduleContext } from '@/lib/time-tracking/today-schedule-context';
export default async function TenantAppLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const tenantSlug = headerList.get('x-tenant-slug');

  if (!tenantSlug) redirect('/login');

  const ctx = await requireTenantMember(tenantSlug);
  const tenant = ctx.tenant ?? (await getTenantBySlug(tenantSlug));
  if (!tenant) redirect('/login');

  const theme = {
    name: tenant.name,
    logoUrl: tenant.logo_url,
    brandColor: tenant.brand_color,
    accentColor: tenant.accent_color,
    sidebarColor: tenant.sidebar_color,
    sidebarTextColor: tenant.sidebar_text_color,
    surfaceColor: tenant.surface_color,
  };

  const canRecordTime = canAccess(ctx, 'zeiten.record');
  const supabase = await createClient();

  let todayEntry = null;
  let todayIntervals: TimeEntryInterval[] = [];
  let todayScheduleContext: TodayScheduleContext | null = null;
  const workDate = todayWorkDate();
  const canViewMessages = canAccess(ctx, 'nav.nachrichten');
  const canManageOrders = canAccess(ctx, 'nav.bestellungen') && canAccess(ctx, 'orders.manage');
  const canApproveTimes = canAccess(ctx, 'nav.zeiten') && canAccess(ctx, 'zeiten.approve');
  const canViewDokumentation = canAccess(ctx, 'nav.dokumentation');

  const [
    workSessionBundle,
    tenantRolesResult,
    initialUnreadCount,
    initialPendingOrderCount,
    initialPendingTimeApprovalCount,
    foremanDutyToday,
  ] = await Promise.all([
    canRecordTime
      ? Promise.all([
          loadTodayWorkSession(supabase, tenant.id, ctx.userId, workDate),
          buildTodayScheduleContext(supabase, tenant.id, ctx.userId),
        ] as const)
      : Promise.resolve(null),
    process.env.NODE_ENV === 'development'
      ? getTenantRoles(supabase, tenant.id)
      : Promise.resolve([] as Awaited<ReturnType<typeof getTenantRoles>>),
    canViewMessages ? getUnreadMessageCount() : Promise.resolve(0),
    canManageOrders ? getPendingOrderCount() : Promise.resolve(0),
    canApproveTimes ? getPendingTimeApprovalCount() : Promise.resolve(0),
    !canViewDokumentation
      ? userHasForemanDutyOnDate(supabase, tenant.id, ctx.userId, workDate)
      : Promise.resolve(false),
  ]);

  if (workSessionBundle) {
    const [session, scheduleContext] = workSessionBundle;
    todayEntry = session.entry;
    todayIntervals = session.intervals;
    todayScheduleContext = scheduleContext;
  }

  const tenantRoles = tenantRolesResult;
  const showDokumentationAsForeman = !canViewDokumentation && foremanDutyToday;

  return (
    <div style={tenantThemeStyle(tenant)}>
      <GpsProvider enabled={tenant.gps_enabled !== false}>
      <TenantShell
        theme={theme}
        profile={ctx.profile}
        permissions={[...ctx.permissions]}
        isSuperadminBypass={ctx.isSuperadminBypass}
        tenantRoleName={ctx.tenantRoleName}
        tenantRoles={tenantRoles}
        actualRoleId={ctx.profile.tenant_role_id}
        devRoleOverrideId={ctx.devRoleOverrideId}
        showDevSwitcher={process.env.NODE_ENV === 'development'}
        todayEntry={todayEntry}
        todayIntervals={todayIntervals}
        todayScheduleContext={todayScheduleContext}
        canRecordTime={canRecordTime}
        initialUnreadCount={initialUnreadCount}
        initialPendingOrderCount={initialPendingOrderCount}
        initialPendingTimeApprovalCount={initialPendingTimeApprovalCount}
        tenantId={tenant.id}
        showDokumentationAsForeman={showDokumentationAsForeman}
      >
        {children}
      </TenantShell>
      </GpsProvider>
    </div>
  );
}
