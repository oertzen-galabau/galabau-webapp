'use client';

import { Camera, Upload } from 'lucide-react';
import { useId, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
  label: string;
  name: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  capture?: 'user' | 'environment';
  className?: string;
  hint?: string;
  inputRef?: Ref<HTMLInputElement>;
  trailingAction?: ReactNode;
  allowCamera?: boolean;
  compact?: boolean;
};

function formatFileList(files: FileList | null): string {
  if (!files?.length) return 'Keine Datei ausgewählt';
  if (files.length === 1) return files[0].name;
  return `${files.length} Dateien ausgewählt`;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export function FileInputField({
  label,
  name,
  accept,
  multiple = false,
  required = false,
  capture,
  className,
  hint,
  inputRef,
  trailingAction,
  allowCamera = false,
  compact = false,
}: Props) {
  const submittedInputId = useId();
  const filePickerId = useId();
  const cameraInputId = useId();
  const submittedInputRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraPickerRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState('Keine Datei ausgewählt');

  function setSubmittedRef(element: HTMLInputElement | null) {
    submittedInputRef.current = element;
    assignRef(inputRef, element);
  }

  function applySelection(files: FileList | null) {
    setSelection(formatFileList(files));
    if (!submittedInputRef.current) return;
    submittedInputRef.current.files = files ?? new DataTransfer().files;
  }

  function handlePickerChange(event: React.ChangeEvent<HTMLInputElement>) {
    applySelection(event.target.files);
  }

  function handleCameraChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    applySelection(dataTransfer.files);
    event.target.value = '';
  }

  const useButtonOnly = compact || Boolean(trailingAction);
  const useSplitInputs = useButtonOnly && allowCamera;

  const submittedInput = (
    <input
      id={submittedInputId}
      ref={setSubmittedRef}
      type="file"
      name={name}
      accept={accept}
      multiple={multiple}
      required={required}
      tabIndex={-1}
      className="input-form-file-native-hidden"
      onChange={(event) => setSelection(formatFileList(event.target.files))}
    />
  );

  const fileInput = useSplitInputs ? (
    <>
      {submittedInput}
      <input
        id={filePickerId}
        ref={filePickerRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="input-form-file-native-hidden"
        onChange={handlePickerChange}
      />
      <input
        id={cameraInputId}
        ref={cameraPickerRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="input-form-file-native-hidden"
        onChange={handleCameraChange}
      />
    </>
  ) : (
    <input
      id={submittedInputId}
      ref={setSubmittedRef}
      type="file"
      name={name}
      accept={accept}
      multiple={multiple}
      required={required}
      capture={capture}
      className={useButtonOnly ? 'input-form-file-native-hidden' : 'input-form-file-native'}
      onChange={(event) => setSelection(formatFileList(event.target.files))}
    />
  );

  const content = (
    <>
      {useButtonOnly ? (
        <span className="input-form-file-label">{label}</span>
      ) : (
        label
      )}
      <div className={['input-form-file-row', useButtonOnly ? 'input-form-file-row--with-action' : ''].filter(Boolean).join(' ')}>
        <div className={['input-form-file-zone', useButtonOnly ? 'input-form-file-zone--button-only' : ''].filter(Boolean).join(' ')}>
          <Upload size={18} aria-hidden />
          {useButtonOnly ? (
            <div className="input-form-file-actions">
              {useSplitInputs ? (
                <>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="input-form-file-cta">
                      Datei hinzufügen
                    </DropdownMenuTrigger>
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
                  {fileInput}
                </>
              ) : (
                <label htmlFor={submittedInputId} className="input-form-file-cta">
                  Datei auswählen
                  {fileInput}
                </label>
              )}
            </div>
          ) : (
            <>
              <span className="input-form-file-cta">Datei auswählen</span>
              {hint && <span className="input-form-file-hint">{hint}</span>}
              {fileInput}
            </>
          )}
        </div>
        {trailingAction}
      </div>
      <span className="input-form-file-selected">{selection}</span>
    </>
  );

  if (useButtonOnly) {
    return <div className={['input-form-file', className].filter(Boolean).join(' ')}>{content}</div>;
  }

  return (
    <label className={['input-form-file', className].filter(Boolean).join(' ')} htmlFor={submittedInputId}>
      {content}
    </label>
  );
}
