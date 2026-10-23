'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearSiteCoverAction,
  setSiteCoverFromDocumentAction,
  updateSiteIconAction,
  uploadSiteCoverAction,
} from '@/lib/actions/site-appearance';
import type { SiteFormState } from '@/lib/actions/admin';
import { DEFAULT_SITE_ICON_KEY, SITE_ICON_OPTIONS } from '@/lib/sites/appearance-icons';
import { resolveSiteCover, isImageSiteDocument } from '@/lib/sites/resolve-site-cover';
import { SiteListPreview } from '@/components/sites/site-list-preview';
import { SiteCoverPickerDialog } from '@/components/sites/site-cover-picker-dialog';
import { FileInputField } from '@/components/ui/file-input-field';
import type { Site } from '@/lib/types/database';

const initialState: SiteFormState = { error: null };

type DocumentRow = {
  id: string;
  title: string;
  file_url: string | null;
  file_type: string | null;
};

type Props = {
  site: Site;
  documents: DocumentRow[];
  signedUrls: Record<string, string>;
};

export function SiteAppearanceSection({ site, documents, signedUrls }: Props) {
  const router = useRouter();
  const signedMap = useMemo(() => new Map(Object.entries(signedUrls)), [signedUrls]);
  const documentPathById = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) {
      if (doc.file_url) map.set(doc.id, doc.file_url);
    }
    return map;
  }, [documents]);

  const cover = resolveSiteCover(site, signedMap, documentPathById);

  const [iconState, iconAction, iconPending] = useActionState(updateSiteIconAction, initialState);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadSiteCoverAction, initialState);
  const [pickState, pickAction, pickPending] = useActionState(setSiteCoverFromDocumentAction, initialState);
  const [clearState, clearAction, clearPending] = useActionState(clearSiteCoverAction, initialState);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(site.icon_key || DEFAULT_SITE_ICON_KEY);

  const imageDocuments = useMemo(
    () =>
      documents
        .filter((d) => d.file_url && isImageSiteDocument(d.file_type))
        .map((d) => ({
          id: d.id,
          title: d.title,
          previewUrl: signedMap.get(d.file_url!) ?? '',
        }))
        .filter((d) => d.previewUrl),
    [documents, signedMap],
  );

  const anyPending = iconPending || uploadPending || pickPending || clearPending;
  const error =
    iconState.error ?? uploadState.error ?? pickState.error ?? clearState.error ?? null;

  const lastOk = useRef(false);
  const okNow =
    Boolean(iconState.ok || uploadState.ok || pickState.ok || clearState.ok) && !error;
  useEffect(() => {
    if (okNow && !lastOk.current) {
      router.refresh();
    }
    lastOk.current = okNow;
  }, [okNow, router]);

  function submitPick(documentId: string) {
    const fd = new FormData();
    fd.set('site_id', site.id);
    fd.set('document_id', documentId);
    pickAction(fd);
    setPickerOpen(false);
  }

  return (
    <section className="panel form-panel site-appearance-section">
      <details className="site-appearance-disclosure">
        <summary>Darstellung</summary>
        <div className="site-appearance-disclosure-body">
          <p className="muted">Icon für die Liste und optional ein Titelbild (Upload oder aus Baustellen-Dokumenten).</p>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="site-appearance-preview-row">
        <SiteListPreview cover={cover} />
      </div>

      <form action={iconAction} className="site-appearance-icon-form">
        <input type="hidden" name="site_id" value={site.id} />
        <input type="hidden" name="icon_key" value={selectedIcon} />
        <span className="site-appearance-label">Icon</span>
        <div className="site-appearance-icon-grid" role="radiogroup" aria-label="Baustellen-Icon">
          {SITE_ICON_OPTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selectedIcon === key}
              className={selectedIcon === key ? 'site-appearance-icon-option is-selected' : 'site-appearance-icon-option'}
              disabled={anyPending}
              onClick={() => setSelectedIcon(key)}
              title={label}
            >
              <Icon size={22} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="input-form-actions">
          <button type="submit" className="secondary-button secondary-button--compact" disabled={anyPending}>
            {iconPending ? 'Speichern…' : 'Icon speichern'}
          </button>
        </div>
      </form>

      <form action={uploadAction} className="input-form" style={{ marginTop: 16 }}>
        <input type="hidden" name="site_id" value={site.id} />
        <FileInputField
          label="Titelbild hochladen"
          name="cover"
          accept="image/png,image/jpeg,image/webp"
          hint="JPEG, PNG oder WebP, max. 2 MB"
        />
        <div className="input-form-actions">
          <button type="button" className="secondary-button secondary-button--compact" disabled={anyPending} onClick={() => setPickerOpen(true)}>
            Aus Dokumenten wählen
          </button>
          <button type="submit" className="primary-button primary-button--compact" disabled={uploadPending}>
            {uploadPending ? 'Wird hochgeladen…' : 'Titelbild speichern'}
          </button>
        </div>
      </form>

      {(site.cover_image_path || site.cover_document_id) && (
        <form action={clearAction} className="input-form-actions" style={{ marginTop: 12 }}>
          <input type="hidden" name="site_id" value={site.id} />
          <button type="submit" className="text-button" disabled={clearPending}>
            {clearPending ? 'Wird entfernt…' : 'Titelbild entfernen'}
          </button>
        </form>
      )}

          <SiteCoverPickerDialog
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            documents={imageDocuments}
            onSelect={submitPick}
            pending={pickPending}
          />
        </div>
      </details>
    </section>
  );
}
