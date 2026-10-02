'use client';

import { useActionState } from 'react';
import { uploadSiteDocumentAction, type SiteFormState } from '@/lib/actions/admin';
import { FileInputField } from '@/components/ui/file-input-field';
import { AppSelect } from '@/components/ui/app-select';

const CATEGORY_OPTIONS = [
  { value: 'plan', label: 'Plan' },
  { value: 'leistungsverzeichnis', label: 'Leistungsverzeichnis' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

const initialState: SiteFormState = { error: null };

type Props = {
  siteId: string;
};

export function SiteDocumentUploadForm({ siteId }: Props) {
  const [state, action, pending] = useActionState(uploadSiteDocumentAction, initialState);

  return (
    <form action={action} className="input-form" style={{ marginTop: 16 }}>
      <input type="hidden" name="site_id" value={siteId} />
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="form-feedback form-feedback--success">Dokument hochgeladen.</p>
      )}
      <div className="input-form-core">
        <label>
          Titel
          <input name="title" placeholder="z.B. Lageplan Süd" disabled={pending} />
        </label>
        <label>
          Kategorie
          <AppSelect
            name="category"
            defaultValue="sonstiges"
            allowEmpty={false}
            options={CATEGORY_OPTIONS}
            disabled={pending}
          />
        </label>
        <FileInputField
          label="Datei"
          name="file"
          accept="application/pdf,image/*"
          required
          hint="PDF oder Bild (max. 10 MB)"
        />
      </div>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
          {pending ? 'Wird hochgeladen…' : 'Dokument hochladen'}
        </button>
      </div>
    </form>
  );
}
