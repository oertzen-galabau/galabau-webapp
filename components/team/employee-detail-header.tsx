import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { initials } from '@/lib/auth/roles';
import type { Profile } from '@/lib/types/database';

type Props = {
  member: Profile;
  roleName: string;
};

export function EmployeeDetailHeader({ member, roleName }: Props) {
  return (
    <div className="page-heading employee-detail-heading">
      <div>
        <Link href="/app/team" className="employee-back-link">
          <ChevronLeft size={18} />
          Zurück zur Teamliste
        </Link>
        <div className="employee-detail-title">
          <span className="person-avatar person-avatar--lg">{initials(member)}</span>
          <div>
            <span className={`status-badge ${member.is_active ? 'active' : 'travel'}`}>
              {member.is_active ? 'Aktiv' : 'Inaktiv'}
            </span>
            <h1>{member.first_name} {member.last_name}</h1>
            <p>
              {roleName}
              {member.personnel_number ? ` · Nr. ${member.personnel_number}` : ''}
              {member.job_title ? ` · ${member.job_title}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
