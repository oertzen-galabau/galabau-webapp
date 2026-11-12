'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

export type SuperadminTabId = 'mandanten' | 'feedback' | 'anfragen';

const TABS: { id: SuperadminTabId; label: string }[] = [
  { id: 'mandanten', label: 'Mandanten' },
  { id: 'feedback', label: 'Feedback & Bugs' },
  { id: 'anfragen', label: 'Anfragen' },
];

function parseTab(raw: string | null): SuperadminTabId {
  if (raw === 'feedback' || raw === 'anfragen') return raw;
  return 'mandanten';
}

type Props = {
  mandanten: ReactNode;
  feedback: ReactNode;
  anfragen: ReactNode;
  feedbackOpenCount: number;
};

export function SuperadminShell({ mandanten, feedback, anfragen, feedbackOpenCount }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = parseTab(searchParams.get('tab'));

  function selectTab(id: SuperadminTabId) {
    if (id === tab) return;
    const next = id === 'mandanten' ? pathname : `${pathname}?tab=${id}`;
    router.replace(next, { scroll: false });
  }

  return (
    <div className="superadmin-page">
      <header className="marketing-header">
        <div className="marketing-brand">
          <strong>Superadmin</strong>
        </div>
        <nav>
          <Link href="/">Marketing</Link>
          <Link href="/login">Abmelden</Link>
        </nav>
      </header>

      <div className="superadmin-tabs-wrap">
        <nav className="superadmin-tabs" role="tablist" aria-label="Superadmin-Bereiche">
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`superadmin-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`superadmin-panel-${item.id}`}
                className={selected ? 'active' : undefined}
                onClick={() => selectTab(item.id)}
              >
                <span>{item.label}</span>
                {item.id === 'feedback' && feedbackOpenCount > 0 ? (
                  <span className="superadmin-tab-badge">{feedbackOpenCount} offen</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="superadmin-tab-panels">
          <div
            role="tabpanel"
            id="superadmin-panel-mandanten"
            aria-labelledby="superadmin-tab-mandanten"
            hidden={tab !== 'mandanten'}
            className="superadmin-tab-panel-stack"
          >
            {mandanten}
          </div>
          <div
            role="tabpanel"
            id="superadmin-panel-feedback"
            aria-labelledby="superadmin-tab-feedback"
            hidden={tab !== 'feedback'}
          >
            {feedback}
          </div>
          <div
            role="tabpanel"
            id="superadmin-panel-anfragen"
            aria-labelledby="superadmin-tab-anfragen"
            hidden={tab !== 'anfragen'}
          >
            {anfragen}
          </div>
        </div>
      </div>
    </div>
  );
}
