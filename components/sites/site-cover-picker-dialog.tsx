'use client';

import { AppDialog } from '@/components/ui/app-dialogs';

export type SiteCoverDocumentOption = {
  id: string;
  title: string;
  previewUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  documents: SiteCoverDocumentOption[];
  onSelect: (documentId: string) => void;
  pending?: boolean;
};

export function SiteCoverPickerDialog({ open, onClose, documents, onSelect, pending }: Props) {
  return (
    <AppDialog open={open} onClose={onClose} title="Titelbild aus Dokumenten">
      {documents.length === 0 ? (
        <p className="muted">Keine Bild-Dokumente auf dieser Baustelle. Laden Sie zuerst ein Bild unter Dokumente hoch.</p>
      ) : (
        <ul className="site-cover-picker-grid">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className="site-cover-picker-item"
                disabled={pending}
                onClick={() => onSelect(doc.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={doc.previewUrl} alt="" />
                <span>{doc.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppDialog>
  );
}
