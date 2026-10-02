import Link from 'next/link';
import type { OrderTabId } from '@/lib/orders/tabs';

type Tab = { id: OrderTabId; label: string };

type Props = {
  tabs: Tab[];
  activeTab: OrderTabId;
};

export function OrderTabs({ tabs, activeTab }: Props) {
  return (
    <nav className="employee-detail-tabs" aria-label="Bestellungen">
      {tabs.map((tab) => {
        const href = tab.id === 'bestellen'
          ? '/app/bestellungen'
          : tab.id === 'katalog'
            ? '/app/bestellungen?tab=katalog'
            : `/app/bestellungen?tab=${tab.id}`;
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
