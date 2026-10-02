'use client';

import { LayoutGrid, Save, X } from 'lucide-react';

type Props = {
  isEditing: boolean;
  isSaving: boolean;
  saveMessage: string | null;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  variant?: 'inline' | 'sticky';
};

export function InfoboardEditToolbar({
  isEditing,
  isSaving,
  saveMessage,
  onStartEdit,
  onCancel,
  onSave,
  variant = 'inline',
}: Props) {
  if (!isEditing) {
    return (
      <button
        type="button"
        className={`secondary-button infoboard-customize-button${variant === 'sticky' ? ' infoboard-customize-button--full' : ''}`}
        onClick={onStartEdit}
      >
        <LayoutGrid size={16} />
        Anpassen
      </button>
    );
  }

  const className =
    variant === 'sticky'
      ? 'infoboard-edit-actions infoboard-edit-actions--sticky'
      : 'infoboard-edit-actions';

  return (
    <div className={className}>
      {saveMessage && <span className="infoboard-save-message">{saveMessage}</span>}
      <div className="infoboard-edit-actions-buttons">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
          <X size={16} />
          Abbrechen
        </button>
        <button type="button" className="primary-button" onClick={onSave} disabled={isSaving}>
          <Save size={16} />
          {isSaving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
