import Link from 'next/link';

export type LeaveTabId = 'teamkalender' | 'konto' | 'freigabe';

type Tab = { id: LeaveTabId; label: string; href: string };

type Props = {
  activeTab: LeaveTabId;
  showFreigabe: boolean;
};

export function LeaveTabs({ activeTab, showFreigabe }: Props) {
  const tabs: Tab[] = [
    { id: 'teamkalender', label: 'Teamkalender', href: '/app/urlaub' },
    { id: 'konto', label: 'Mein Konto', href: '/app/urlaub/konto' },
  ];
  if (showFreigabe) {
    tabs.push({ id: 'freigabe', label: 'Freigabe', href: '/app/urlaub/freigabe' });
  }

  return (
    <nav className="employee-detail-tabs" aria-label="Abwesenheit">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={tab.id === activeTab ? 'active' : undefined}
          aria-current={tab.id === activeTab ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
