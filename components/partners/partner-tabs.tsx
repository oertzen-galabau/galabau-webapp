import Link from 'next/link';
import type { PartnerTabId } from '@/lib/partners/kind';
import { PARTNER_TAB_LABELS } from '@/lib/partners/kind';
import { partnerSettingsListPath } from '@/lib/partners/paths';

const TABS: PartnerTabId[] = ['subunternehmer', 'lieferanten'];

type Props = {
  activeTab: PartnerTabId;
};

export function PartnerTabs({ activeTab }: Props) {
  return (
    <nav className="employee-detail-tabs" aria-label="Geschäftspartner">
      {TABS.map((tab) => {
        const href = partnerSettingsListPath(tab);
        return (
          <Link
            key={tab}
            href={href}
            className={tab === activeTab ? 'active' : undefined}
            aria-current={tab === activeTab ? 'page' : undefined}
          >
            {PARTNER_TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
