'use client';

import { Camera, Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MAX_REPORT_PHOTOS, MIN_REPORT_PHOTOS } from '@/lib/types/database';

type ExistingPhoto = {
  id: string;
  url: string;
};

type Props = {
  existingPhotos?: ExistingPhoto[];
};

export function ReportPhotoManager({ existingPhotos = [] }: Props) {
  const fileInputId = useId();
  const cameraInputId = useId();
  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraPickerRef = useRef<HTMLInputElement>(null);
  const submitInputRef = useRef<HTMLInputElement>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<Array<{ id: number; file: File; preview: string }>>([]);
  const nextId = useRef(1);

  const activeExisting = existingPhotos.filter((photo) => !removedIds.has(photo.id));
  const totalCount = activeExisting.length + newFiles.length;
  const canAddMore = totalCount < MAX_REPORT_PHOTOS;
  const isValid = totalCount >= MIN_REPORT_PHOTOS && totalCount <= MAX_REPORT_PHOTOS;

  function syncSubmitInput(files: File[]) {
    if (!submitInputRef.current) return;
    const dt = new DataTransfer();
    files.forEach((file) => dt.items.add(file));
    submitInputRef.current.files = dt.files;
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    const remaining = MAX_REPORT_PHOTOS - totalCount;
    const accepted = incoming.slice(0, remaining);

    setNewFiles((current) => {
      const next = [
        ...current,
        ...accepted.map((file) => ({
          id: nextId.current++,
          file,
          preview: URL.createObjectURL(file),
        })),
      ];
      syncSubmitInput(next.map((entry) => entry.file));
      return next;
    });
  }

  function removeNew(id: number) {
    setNewFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      const next = current.filter((entry) => entry.id !== id);
      syncSubmitInput(next.map((entry) => entry.file));
      return next;
    });
  }

  function toggleRemoveExisting(id: string) {
    setRemovedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="report-photo-manager report-photo-manager-root">
      <div className="report-photo-manager-header">
        <p className="report-photo-manager-title">
          Fotos <span className="report-photo-required">Pflicht</span>
        </p>
        <span className={['report-photo-counter', isValid ? 'report-photo-counter--ok' : 'report-photo-counter--warn'].join(' ')}>
          {totalCount} / {MAX_REPORT_PHOTOS} (min. {MIN_REPORT_PHOTOS})
        </span>
      </div>
      <p className="muted report-photo-hint">Mindestens {MIN_REPORT_PHOTOS}, maximal {MAX_REPORT_PHOTOS} Baustellenfotos.</p>

      <div className="report-photo-grid-input">
        {activeExisting.map((photo) => (
          <div key={photo.id} className="report-photo-card">
            <img src={photo.url} alt="Vorhandenes Baustellenfoto" />
            <button type="button" className="report-photo-remove" onClick={() => toggleRemoveExisting(photo.id)} aria-label="Foto entfernen">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {newFiles.map((entry) => (
          <div key={entry.id} className="report-photo-card">
            <img src={entry.preview} alt="Neues Baustellenfoto" />
            <button type="button" className="report-photo-remove" onClick={() => removeNew(entry.id)} aria-label="Foto entfernen">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {canAddMore && (
        <div className="input-form-file report-photo-add-control">
          <div className="input-form-file-row input-form-file-row--with-action">
            <div className="input-form-file-zone input-form-file-zone--button-only">
              <Upload size={18} aria-hidden />
              <div className="input-form-file-actions">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="input-form-file-cta">Foto hinzufügen</DropdownMenuTrigger>
                  <DropdownMenuContent className="input-form-file-source-menu" align="start">
                    <DropdownMenuItem
                      className="input-form-file-source-item"
                      onClick={() => filePickerRef.current?.click()}
                    >
                      <Upload size={16} aria-hidden />
                      Hochladen
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="input-form-file-source-item"
                      onClick={() => cameraPickerRef.current?.click()}
                    >
                      <Camera size={16} aria-hidden />
                      Foto machen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <span className="input-form-file-selected">
            {totalCount === 0
              ? 'Keine Fotos ausgewählt'
              : `${totalCount} Foto${totalCount === 1 ? '' : 's'} ausgewählt`}
          </span>
        </div>
      )}

      <input
        id={fileInputId}
        ref={filePickerRef}
        type="file"
        accept="image/*"
        multiple
        className="input-form-file-native-hidden report-photo-file-input"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        id={cameraInputId}
        ref={cameraPickerRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="input-form-file-native-hidden report-photo-file-input"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input ref={submitInputRef} type="file" name="photos" multiple className="input-form-file-native-hidden report-photo-file-input" tabIndex={-1} />

      {[...removedIds].map((id) => (
        <input key={id} type="hidden" name="removed_photo_id[]" value={id} />
      ))}

      {!isValid && (
        <p className="form-error report-photo-error">
          {totalCount < MIN_REPORT_PHOTOS
            ? `Es fehlen noch ${MIN_REPORT_PHOTOS - totalCount} Foto(s).`
            : `Maximal ${MAX_REPORT_PHOTOS} Fotos erlaubt.`}
        </p>
      )}
    </div>
  );
}
