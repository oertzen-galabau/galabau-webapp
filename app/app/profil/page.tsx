import { createClient } from '@/lib/supabase/server';
import { canAccess, getTenantIdForSession, requireTenantMember } from '@/lib/auth/session';
import { listMyLeaveRequestsPreview } from '@/lib/leave/queries';
import { ProfilePageHeader } from '@/components/profile/profile-page-header';
import { ProfileRequestsOverview } from '@/components/profile/profile-requests-overview';
import { ProfilePersonalForm } from '@/components/profile/profile-personal-form';
import { ProfileSecuritySection } from '@/components/profile/profile-security-section';
import { ProfileWorkReadonly } from '@/components/profile/profile-work-readonly';

export default async function ProfilPage() {
  const ctx = await requireTenantMember();
  const roleName = ctx.tenantRoleName ?? '—';

  const canEditSelf = canAccess(ctx, 'profile.edit_self');
  const canChangeEmail = canAccess(ctx, 'profile.change_email');
  const canChangePassword = canAccess(ctx, 'profile.change_password');

  const tenantId = await getTenantIdForSession(ctx);
  const supabase = await createClient();
  const [{ data: leaveRequests }, { data: catalogOrders }, { data: clothingOrders }] = await Promise.all([
    tenantId
      ? listMyLeaveRequestsPreview(supabase, tenantId, ctx.userId, 5)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('catalog_orders')
      .select('id, created_at, total_eur, own_share_eur, status')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('clothing_orders')
      .select('id, created_at, item_type, size, status')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <>
      <ProfilePageHeader profile={ctx.profile} roleName={roleName} />

      <div className="profile-sections">
        <ProfileRequestsOverview
          leaveRequests={leaveRequests ?? []}
          catalogOrders={catalogOrders ?? []}
          clothingOrders={clothingOrders ?? []}
        />
        <ProfilePersonalForm profile={ctx.profile} editable={canEditSelf} />
        <ProfileWorkReadonly profile={ctx.profile} roleName={roleName} />
        <ProfileSecuritySection
          email={ctx.profile.email}
          canChangeEmail={canChangeEmail}
          canChangePassword={canChangePassword}
        />
      </div>
    </>
  );
}
