'use client';

import { useState } from 'react';
import { deleteSiteDocument } from '@/lib/actions/admin';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';
import { AppDialog } from '@/components/ui/app-dialogs';
import { isImageSiteDocument } from '@/lib/sites/resolve-site-cover';

export type SiteDocumentPhoto = {
  id: string;
  title: string;
  file_url: string | null;
  file_type: string | null;
};

type Props = {
  photos: SiteDocumentPhoto[];
  signedUrls: Map<string, string>;
  canEdit: boolean;
};

export function SiteDocumentPhotoGroup({ photos, signedUrls, canEdit }: Props) {
  const [lightbox, setLightbox] = useState<SiteDocumentPhoto | null>(null);
  const lightboxUrl = lightbox?.file_url ? signedUrls.get(lightbox.file_url) : null;

  return (
    <div className="site-doc-group">
      <h3>Fotos</h3>
      {photos.length > 0 ? (
        <ul className="site-doc-photo-grid">
          {photos.map((photo) => {
            const url = photo.file_url ? signedUrls.get(photo.file_url) : null;
            const isImage =
              Boolean(url) && (!photo.file_type || isImageSiteDocument(photo.file_type));
            return (
              <li key={photo.id} className="site-doc-photo-item">
                {isImage && url ? (
                  <button
                    type="button"
                    className="site-doc-photo-thumb"
                    onClick={() => setLightbox(photo)}
                    aria-label={`Foto vergrößern: ${photo.title}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={photo.title} />
                  </button>
                ) : url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="site-doc-photo-thumb site-doc-photo-thumb--file"
                  >
                    {photo.title}
                  </a>
                ) : (
                  <div className="site-doc-photo-thumb site-doc-photo-thumb--file muted">
                    {photo.title}
                  </div>
                )}
                <div className="site-doc-photo-meta">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="site-doc-photo-title">
                      {photo.title}
                    </a>
                  ) : (
                    <span className="site-doc-photo-title">{photo.title}</span>
                  )}
                  {canEdit ? (
                    <SiteEntityDeleteButton
                      id={photo.id}
                      entityLabel="Foto"
                      onDelete={deleteSiteDocument}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Keine Fotos hinterlegt.</p>
      )}

      <AppDialog
        open={Boolean(lightboxUrl)}
        onClose={() => setLightbox(null)}
        title={lightbox?.title ?? 'Foto'}
        panelClassName="dialog-panel--image"
      >
        {lightboxUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lightboxUrl} alt={lightbox?.title ?? 'Foto'} />
        ) : null}
      </AppDialog>
    </div>
  );
}
