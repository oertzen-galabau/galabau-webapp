'use client';

import { LayoutGrid, Save, X } from 'lucide-react';

type Props = {
  isEditing: boolean;
  isSaving: boolean;
  saveMessage: string | null;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function InfoboardEditToolbar({
  isEditing,
  isSaving,
  saveMessage,
  onStartEdit,
  onCancel,
  onSave,
}: Props) {
  if (!isEditing) {
    return (
      <button type="button" className="secondary-button" onClick={onStartEdit}>
        <LayoutGrid size={16} />
        Anpassen
      </button>
    );
  }

  return (
    <div className="infoboard-edit-actions">
      {saveMessage && <span className="infoboard-save-message">{saveMessage}</span>}
      <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
        <X size={16} />
        Abbrechen
      </button>
      <button type="button" className="primary-button" onClick={onSave} disabled={isSaving}>
        <Save size={16} />
        {isSaving ? 'Speichern…' : 'Speichern'}
      </button>
    </div>
  );
}
