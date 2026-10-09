'use client';

import {
  DEFAULT_DAILY_REPORT_SHORT_LABEL,
  DEFAULT_HOURLY_WAGE_RAPPORT_SHORT_LABEL,
} from '@/lib/documentation/report-labels';
import type { Tenant } from '@/lib/types/database';
import { saveTenantReportLabels } from '@/lib/actions/documentation-settings';

type Props = {
  tenant: Pick<Tenant, 'daily_report_label' | 'hourly_wage_rapport_label'>;
};

export function TenantReportLabelsForm({ tenant }: Props) {
  return (
    <section className="panel form-panel">
      <h2>Bezeichnungen der Berichtsarten</h2>
      <p className="muted">
        Diese Namen erscheinen bei der Berichtserfassung, in Listen und in PDFs (sofern kein eigener Titel gesetzt ist).
        Leer lassen = Standardbezeichnung.
      </p>
      <form action={saveTenantReportLabels} className="input-form">
        <div className="input-form-core">
          <label>
            Tagesbericht
            <input
              name="daily_report_label"
              maxLength={120}
              defaultValue={tenant.daily_report_label ?? ''}
              placeholder={DEFAULT_DAILY_REPORT_SHORT_LABEL}
            />
          </label>
          <label>
            Std.-Lohnarbeit (Rapport)
            <input
              name="hourly_wage_rapport_label"
              maxLength={120}
              defaultValue={tenant.hourly_wage_rapport_label ?? ''}
              placeholder={DEFAULT_HOURLY_WAGE_RAPPORT_SHORT_LABEL}
            />
          </label>
        </div>
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">Speichern</button>
        </div>
      </form>
    </section>
  );
}
