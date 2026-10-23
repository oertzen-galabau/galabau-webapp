'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';
import type { DocumentationOverviewItem } from '@/lib/documentation/documentation-overview-types';

type Props = {
  items: DocumentationOverviewItem[];
  emptyMessage?: string;
};

function formatDisplayDate(isoDate: string) {
  if (!isoDate) return '—';
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function lightboxTitle(item: DocumentationOverviewItem): string {
  const date = formatDisplayDate(item.sortDate);
  const site = item.siteName?.trim();
  if (site && item.title?.trim() && item.title !== `Foto · ${item.sortDate}`) {
    return `${site} · ${date}`;
  }
  if (site) return `${site} · ${date}`;
  return item.title?.trim() || `Foto · ${date}`;
}

export function DocumentsPhotoGrid({
  items,
  emptyMessage = 'Keine Fotos für die aktuelle Auswahl.',
}: Props) {
  const [lightbox, setLightbox] = useState<DocumentationOverviewItem | null>(null);

  if (items.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <>
      <ul className="documents-photo-grid">
        {items.map((item) => (
          <li key={item.id} className="documents-photo-grid-item">
            {item.fileUrl ? (
              <button
                type="button"
                className="documents-photo-grid-link"
                onClick={() => setLightbox(item)}
                aria-label={`Foto vergrößern: ${item.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.fileUrl}
                  alt={item.title}
                  className="documents-photo-grid-thumb"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className="documents-photo-grid-placeholder muted">{item.title}</div>
            )}
            <div className="documents-photo-grid-meta">
              <span className="documents-photo-grid-date">{formatDisplayDate(item.sortDate)}</span>
              <Link href={`/app/baustellen/${item.siteId}`} className="table-action-link">
                {item.siteName || '—'}
              </Link>
              {item.title ? (
                <span className="documents-photo-grid-caption">{item.title}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <AppDialog
        open={Boolean(lightbox?.fileUrl)}
        onClose={() => setLightbox(null)}
        title={lightbox ? lightboxTitle(lightbox) : ''}
        panelClassName="dialog-panel--image"
      >
        {lightbox?.fileUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.fileUrl} alt={lightbox.title} />
            {lightbox.title ? (
              <p className="documents-photo-lightbox-caption muted">{lightbox.title}</p>
            ) : null}
          </>
        ) : null}
      </AppDialog>
    </>
  );
}
