import Link from 'next/link';
import type { EmployeeTabId } from '@/lib/team/detail-tabs';

type Tab = { id: EmployeeTabId; label: string };

type Props = {
  employeeId: string;
  tabs: Tab[];
  activeTab: EmployeeTabId;
  month?: string;
};

export function EmployeeDetailTabs({ employeeId, tabs, activeTab, month }: Props) {
  return (
    <nav className="employee-detail-tabs" aria-label="Mitarbeiter-Bereiche">
      {tabs.map((tab) => {
        const params = new URLSearchParams({ tab: tab.id });
        if (tab.id === 'zeiten' && month) params.set('month', month);
        const href = `/app/team/${employeeId}?${params.toString()}`;
        return (
          <Link
            key={tab.id}
            href={href}
            className={tab.id === activeTab ? 'active' : undefined}
            aria-current={tab.id === activeTab ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
