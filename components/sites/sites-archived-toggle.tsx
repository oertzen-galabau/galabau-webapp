'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function SitesArchivedToggle() {
  const searchParams = useSearchParams();
  const showArchived = searchParams.get('archived') === '1';

  return (
    <Link
      href={showArchived ? '/app/baustellen' : '/app/baustellen?archived=1'}
      className="text-button"
      prefetch={false}
    >
      {showArchived ? 'Archivierte ausblenden' : 'Archivierte anzeigen'}
    </Link>
  );
}
