'use client';

import { useState } from 'react';
import { AppSelect } from '@/components/ui/app-select';

type Props = {
  action: (formData: FormData) => Promise<void>;
};

const LEAVE_TYPE_OPTIONS = [
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'krankheit', label: 'Krankheit' },
  { value: 'arzt', label: 'Arzt' },
  { value: 'amt', label: 'Amt' },
  { value: 'schule', label: 'Schule' },
  { value: 'sonstige', label: 'Sonstige' },
];

export function LeaveRequestForm({ action }: Props) {
  const [leaveType, setLeaveType] = useState('urlaub');
  const isSonstige = leaveType === 'sonstige';

  return (
    <form action={action} className="input-form">
      <div className="input-form-core">
        <label>
          Art
          <AppSelect
            name="leave_type"
            value={leaveType}
            onValueChange={setLeaveType}
            options={LEAVE_TYPE_OPTIONS}
            allowEmpty={false}
            required
          />
        </label>
        <label>
          Von
          <input type="date" name="start_date" required />
        </label>
        <label>
          Bis
          <input type="date" name="end_date" required />
        </label>
        {isSonstige && (
          <label className="input-form-span-full">
            Grund
            <input type="text" name="reason" required placeholder="z. B. Umzug, Hochzeit …" />
          </label>
        )}
      </div>
      {!isSonstige && (
        <details className="input-form-extra">
          <summary>Notiz</summary>
          <div className="input-form-extra-grid">
            <label className="input-form-span-full">
              Notiz
              <textarea name="notes" rows={2} />
            </label>
          </div>
        </details>
      )}
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">
          Einreichen
        </button>
      </div>
    </form>
  );
}
