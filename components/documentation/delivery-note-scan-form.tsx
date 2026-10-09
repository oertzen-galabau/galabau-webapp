'use client';

import { AppSelect } from '@/components/ui/app-select';
import { DeliveryNoteBlockFields } from '@/components/documentation/delivery-note-block-fields';
import type { BusinessPartnerFieldOption } from '@/components/documentation/business-partner-field';

type DailyLogOption = {
  id: string;
  label: string;
};

type Props = {
  logs: DailyLogOption[];
  suppliers: BusinessPartnerFieldOption[];
  saveAction: (formData: FormData) => void | Promise<void>;
};

export function DeliveryNoteScanForm({ logs, suppliers, saveAction }: Props) {
  return (
    <form action={saveAction} className="input-form delivery-note-scan-form">
      <div className="input-form-core">
        <label>
          Tageseintrag
          <AppSelect
            name="daily_log_id"
            required
            allowEmpty={false}
            defaultValue={logs[0]?.id ?? ''}
            options={logs.map((log) => ({ value: log.id, label: log.label }))}
          />
        </label>
      </div>

      <DeliveryNoteBlockFields namePrefix="standalone" suppliers={suppliers} />

      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">
          Lieferung speichern
        </button>
      </div>
    </form>
  );
}
