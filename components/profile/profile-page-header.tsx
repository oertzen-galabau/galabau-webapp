import { initials } from '@/lib/auth/roles';
import { MemberAccessBadge } from '@/components/team/member-access-badge';
import type { Profile } from '@/lib/types/database';

type Props = {
  profile: Profile;
  roleName: string;
};

export function ProfilePageHeader({ profile, roleName }: Props) {
  return (
    <div className="page-heading employee-detail-heading">
      <div>
        <div className="employee-detail-title">
          <span className="person-avatar person-avatar--lg">{initials(profile)}</span>
          <div>
            <MemberAccessBadge
              is_active={profile.is_active}
              must_change_password={profile.must_change_password}
            />
            <h1>{profile.first_name} {profile.last_name}</h1>
            <p>
              {roleName}
              {profile.email ? ` · ${profile.email}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
