import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TenantShell } from '@/components/app-shell/tenant-shell';
import { getUnreadMessageCount } from '@/lib/actions/employee';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { getTenantBySlug, tenantThemeStyle } from '@/lib/tenant/resolve';
import { getTenantRoles } from '@/lib/tenant/roles';
import { createClient } from '@/lib/supabase/server';
import { todayWorkDate } from '@/lib/time-tracking/work-day';
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
  if (canRecordTime) {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', ctx.userId)
      .eq('work_date', todayWorkDate())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    todayEntry = data;
  }

  let tenantRoles: Awaited<ReturnType<typeof getTenantRoles>> = [];
  if (process.env.NODE_ENV === 'development') {
    tenantRoles = await getTenantRoles(supabase, tenant.id);
  }

  const canViewMessages = canAccess(ctx, 'nav.nachrichten');
  const initialUnreadCount = canViewMessages ? await getUnreadMessageCount() : 0;

  return (
    <div style={tenantThemeStyle(tenant)}>
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
        canRecordTime={canRecordTime}
        initialUnreadCount={initialUnreadCount}
      >
        {children}
      </TenantShell>
    </div>
  );
}
