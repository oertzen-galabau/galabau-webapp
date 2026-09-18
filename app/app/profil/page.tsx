import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { ProfilePageHeader } from '@/components/profile/profile-page-header';
import { ProfilePersonalForm } from '@/components/profile/profile-personal-form';
import { ProfileSecuritySection } from '@/components/profile/profile-security-section';
import { ProfileWorkReadonly } from '@/components/profile/profile-work-readonly';

export default async function ProfilPage() {
  const ctx = await requireTenantMember();
  const roleName = ctx.tenantRoleName ?? '—';

  const canEditSelf = canAccess(ctx, 'profile.edit_self');
  const canChangeEmail = canAccess(ctx, 'profile.change_email');
  const canChangePassword = canAccess(ctx, 'profile.change_password');

  return (
    <>
      <ProfilePageHeader profile={ctx.profile} roleName={roleName} />

      <div className="profile-sections">
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
