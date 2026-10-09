'use client';

import { BusinessPartnerField, type BusinessPartnerFieldOption } from '@/components/documentation/business-partner-field';

type Props = {
  dailyLogId: string;
  partners: BusinessPartnerFieldOption[];
  saveAction: (formData: FormData) => void | Promise<void>;
};

export function SubcontractorEntryForm({ dailyLogId, partners, saveAction }: Props) {
  return (
    <form action={saveAction} className="input-form">
      <input type="hidden" name="daily_log_id" value={dailyLogId} />
      <div className="input-form-core">
        <BusinessPartnerField
          partners={partners}
          freeTextFieldName="company_name"
          freeTextLabel="Firma (Freitext)"
          freeTextPlaceholder="Subunternehmer"
          selectLabel="Subunternehmer"
          required
        />
        <label>Gewerk / Beschreibung<input name="work_description" placeholder="z.B. Pflasterarbeiten" /></label>
        <label>Stunden<input type="number" step="0.25" name="hours" min={0} /></label>
      </div>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">Subunternehmer speichern</button>
      </div>
    </form>
  );
}
