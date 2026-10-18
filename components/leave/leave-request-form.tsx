'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { saveLeaveRequestAction, type LeaveFormState } from '@/lib/actions/employee';
import { AppSelect } from '@/components/ui/app-select';

const initialState: LeaveFormState = { error: null };

const LEAVE_TYPE_OPTIONS = [
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'krankheit', label: 'Krankheit' },
  { value: 'arzt', label: 'Arzt' },
  { value: 'amt', label: 'Amt' },
  { value: 'schule', label: 'Schule' },
  { value: 'sonstige', label: 'Sonstige' },
];

export function LeaveRequestForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveLeaveRequestAction, initialState);
  const [leaveType, setLeaveType] = useState('urlaub');
  const isSonstige = leaveType === 'sonstige';

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={action} className="input-form">
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="form-feedback form-feedback--success">Antrag wurde eingereicht.</p>
      )}
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
            disabled={pending}
          />
        </label>
        {isSonstige && (
          <label className="input-form-span-full leave-request-reason">
            Grund <span className="field-required">(Pflichtfeld)</span>
            <input
              type="text"
              name="reason"
              required
              autoFocus
              placeholder="z. B. Umzug, Hochzeit …"
              disabled={pending}
              aria-required="true"
            />
          </label>
        )}
        <label>
          Von
          <input type="date" name="start_date" required disabled={pending} />
        </label>
        <label>
          Bis
          <input type="date" name="end_date" required disabled={pending} />
        </label>
      </div>
      {!isSonstige && (
        <details className="input-form-extra">
          <summary>Notiz</summary>
          <div className="input-form-extra-grid">
            <label className="input-form-span-full">
              Notiz
              <textarea name="notes" rows={2} disabled={pending} />
            </label>
          </div>
        </details>
      )}
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
          {pending ? 'Wird eingereicht …' : 'Einreichen'}
        </button>
      </div>
    </form>
  );
}
