import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { initials } from '@/lib/auth/roles';
import { MemberAccessBadge } from '@/components/team/member-access-badge';
import type { Profile } from '@/lib/types/database';
import type { EmployeeDetailMode } from '@/lib/team/employee-detail-data';

type Props = {
  member: Profile;
  roleName: string;
  mode: EmployeeDetailMode;
};

export function EmployeeDetailHeader({ member, roleName, mode }: Props) {
  const isSelf = mode === 'self';
  const showBack = !isSelf;

  return (
    <div className="page-heading employee-detail-heading">
      <div>
        {showBack && (
          <Link href="/app/team" className="employee-back-link">
            <ChevronLeft size={18} />
            Zurück zur Teamliste
          </Link>
        )}
        <div className="employee-detail-title">
          <span className="person-avatar person-avatar--lg">{initials(member)}</span>
          <div>
            <MemberAccessBadge
              is_active={member.is_active}
              must_change_password={member.must_change_password}
            />
            <h1>
              {member.first_name} {member.last_name}
            </h1>
            <p>
              {roleName}
              {isSelf && member.email ? ` · ${member.email}` : ''}
              {!isSelf && member.personnel_number ? ` · Nr. ${member.personnel_number}` : ''}
              {!isSelf && member.job_title ? ` · ${member.job_title}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
