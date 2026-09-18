import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { TenantRole } from '@/lib/tenant/roles';

type Props = {
  role: TenantRole;
  memberCount: number;
};

export function RoleDetailHeader({ role, memberCount }: Props) {
  return (
    <div className="page-heading employee-detail-heading">
      <div>
        <Link href="/app/rollen" className="employee-back-link">
          <ChevronLeft size={18} />
          Zurück zur Rollenliste
        </Link>
        <div className="employee-detail-title">
          <div>
            <span className={`status-badge ${role.is_system ? 'travel' : 'active'}`}>
              {role.is_system ? 'System-Rolle' : 'Eigene Rolle'}
            </span>
            <h1>{role.name}</h1>
            <p>
              {memberCount} {memberCount === 1 ? 'Mitarbeiter' : 'Mitarbeiter'} zugewiesen
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
