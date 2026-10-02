import Link from 'next/link';
import { CATALOG_SUB_TABS, type CatalogSubTabId } from '@/lib/orders/tabs';

type Props = {
  activeSubTab: CatalogSubTabId;
};

function catalogSubTabHref(id: CatalogSubTabId): string {
  if (id === 'artikel') return '/app/bestellungen?tab=katalog';
  return `/app/bestellungen?tab=katalog&katalog=${id}`;
}

export function OrderCatalogSubTabs({ activeSubTab }: Props) {
  return (
    <nav className="employee-detail-tabs" aria-label="Katalog">
      {CATALOG_SUB_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={catalogSubTabHref(tab.id)}
          className={tab.id === activeSubTab ? 'active' : undefined}
          aria-current={tab.id === activeSubTab ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
