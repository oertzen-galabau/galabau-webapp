'use client';

import { BusinessPartnerField, type BusinessPartnerFieldOption } from '@/components/documentation/business-partner-field';

type LogOption = {
  id: string;
  label: string;
};

type Props = {
  logs: LogOption[];
  partners: BusinessPartnerFieldOption[];
  saveAction: (formData: FormData) => void | Promise<void>;
};

export function SubcontractorEntryForm({ logs, partners, saveAction }: Props) {
  return (
    <form action={saveAction} className="input-form">
      <div className="input-form-core">
        <label>
          Tageseintrag
          <select name="daily_log_id" required defaultValue="">
            <option value="" disabled>—</option>
            {logs.map((log) => (
              <option key={log.id} value={log.id}>
                {log.label}
              </option>
            ))}
          </select>
        </label>
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
