import Link from 'next/link';
import type { SettingsTabId } from '@/lib/settings/tabs';

type Tab = { id: SettingsTabId; label: string };

type Props = {
  tabs: Tab[];
  activeTab: SettingsTabId;
};

export function SettingsTabs({ tabs, activeTab }: Props) {
  return (
    <nav className="employee-detail-tabs" aria-label="Einstellungen">
      {tabs.map((tab) => {
        const href = tab.id === 'allgemein'
          ? '/app/einstellungen'
          : `/app/einstellungen?tab=${tab.id}`;
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
