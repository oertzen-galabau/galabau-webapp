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

function formatLightboxDate(isoDate: string) {
  if (!isoDate) return '—';
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isGenericPhotoTitle(title: string | undefined, sortDate: string) {
  const t = title?.trim();
  if (!t) return true;
  return t === `Foto · ${sortDate}`;
}

function lightboxHeading(item: DocumentationOverviewItem): string {
  const site = item.siteName?.trim();
  const title = item.title?.trim();
  if (site) return site;
  if (title && !isGenericPhotoTitle(title, item.sortDate)) return title;
  return 'Foto';
}

function lightboxCaption(item: DocumentationOverviewItem): string | null {
  const title = item.title?.trim();
  if (!title || isGenericPhotoTitle(title, item.sortDate)) return null;
  const site = item.siteName?.trim();
  if (site && title === site) return null;
  return title;
}

export function DocumentsPhotoGrid({
  items,
  emptyMessage = 'Keine Fotos für die aktuelle Auswahl.',
}: Props) {
  const [lightbox, setLightbox] = useState<DocumentationOverviewItem | null>(null);

  if (items.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  const lightboxCaptionText = lightbox ? lightboxCaption(lightbox) : null;

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
        title={lightbox ? lightboxHeading(lightbox) : ''}
        subtitle={lightbox ? formatLightboxDate(lightbox.sortDate) : undefined}
        panelClassName="dialog-panel--image"
      >
        {lightbox?.fileUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.fileUrl} alt={lightboxHeading(lightbox)} />
            {lightboxCaptionText ? (
              <p className="documents-photo-lightbox-caption muted">{lightboxCaptionText}</p>
            ) : null}
          </>
        ) : null}
      </AppDialog>
    </>
  );
}
