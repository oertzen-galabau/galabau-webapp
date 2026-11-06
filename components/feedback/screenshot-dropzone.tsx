'use client';

import { ImagePlus, X } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { collectImagesFromClipboard } from '@/lib/feedback/clipboard-images';
import { FEEDBACK_SCREENSHOT_MAX_COUNT } from '@/lib/supabase/storage';

type PreviewItem = {
  id: string;
  file: File;
  previewUrl: string;
};

function validateClientFile(file: File): string | null {
  if (file.size > 5 * 1024 * 1024) return 'Max. 5 MB pro Bild';
  const mime = file.type || '';
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null;
  if (file.name.match(/\.(jpe?g|png|webp)$/i)) return null;
  return 'Nur JPEG, PNG oder WebP';
}

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

export type ScreenshotDropzoneHandle = {
  /** true, wenn mindestens ein Bild aus der Zwischenablage übernommen wurde */
  pasteFromClipboard: (data: DataTransfer | null) => boolean;
};

export const ScreenshotDropzone = forwardRef<ScreenshotDropzoneHandle, Props>(function ScreenshotDropzone(
  { files, onChange, disabled = false },
  ref,
) {
  const inputId = useId();
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo<PreviewItem[]>(
    () =>
      files.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const item of previews) URL.revokeObjectURL(item.previewUrl);
    };
  }, [previews]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (disabled) return;
      setError(null);
      const list = [...incoming];
      if (list.length === 0) return;

      const merged = [...files];
      for (const file of list) {
        if (merged.length >= FEEDBACK_SCREENSHOT_MAX_COUNT) {
          setError(`Maximal ${FEEDBACK_SCREENSHOT_MAX_COUNT} Screenshots`);
          break;
        }
        const validationError = validateClientFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }
        const duplicate = merged.some(
          (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
        );
        if (!duplicate) merged.push(file);
      }
      onChange(merged);
    },
    [disabled, files, onChange],
  );

  const pasteFromClipboard = useCallback(
    (data: DataTransfer | null) => {
      if (disabled) return false;
      const pasted = collectImagesFromClipboard(data);
      if (pasted.length === 0) return false;
      addFiles(pasted);
      return true;
    },
    [addFiles, disabled],
  );

  useImperativeHandle(ref, () => ({ pasteFromClipboard }), [pasteFromClipboard]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled) return;
      const pasted = collectImagesFromClipboard(e.clipboardData);
      if (pasted.length === 0) return;

      e.preventDefault();
      addFiles(pasted);
    }

    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
  }, [addFiles, disabled]);

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="feedback-screenshot-field">
      <span className="feedback-screenshot-label">Screenshots (optional)</span>
      <div
        ref={zoneRef}
        className={[
          'feedback-screenshot-zone',
          dragOver ? 'feedback-screenshot-zone--active' : '',
          disabled ? 'feedback-screenshot-zone--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          addFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          if (pasteFromClipboard(e.clipboardData)) e.preventDefault();
        }}
      >
        <ImagePlus size={22} aria-hidden />
        <p>
          Bilder hierher ziehen, <strong>Strg/Cmd+V</strong> zum Einfügen oder{' '}
          <label htmlFor={inputId} className="feedback-screenshot-browse">
            Datei wählen
          </label>
        </p>
        <p className="muted feedback-screenshot-hint">
          JPEG, PNG, WebP · max. 5 MB · bis zu {FEEDBACK_SCREENSHOT_MAX_COUNT} Bilder
        </p>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          className="input-form-file-native-hidden"
          onChange={(e) => {
            addFiles(e.target.files ?? []);
            e.target.value = '';
          }}
        />
      </div>

      {error ? <p className="dialog-error">{error}</p> : null}

      {previews.length > 0 ? (
        <ul className="feedback-screenshot-previews">
          {previews.map((item, index) => (
            <li key={item.id}>
              <img src={item.previewUrl} alt="" />
              <button
                type="button"
                className="feedback-screenshot-remove"
                aria-label="Entfernen"
                disabled={disabled}
                onClick={() => removeAt(index)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
