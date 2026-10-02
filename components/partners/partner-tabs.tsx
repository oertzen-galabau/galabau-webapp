import Link from 'next/link';
import type { PartnerTabId } from '@/lib/partners/kind';
import { PARTNER_TAB_LABELS } from '@/lib/partners/kind';

const TABS: PartnerTabId[] = ['subunternehmer', 'lieferanten'];

type Props = {
  activeTab: PartnerTabId;
};

export function PartnerTabs({ activeTab }: Props) {
  return (
    <nav className="employee-detail-tabs" aria-label="Geschäftspartner">
      {TABS.map((tab) => {
        const href = tab === 'subunternehmer' ? '/app/geschaeftspartner' : '/app/geschaeftspartner?tab=lieferanten';
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
