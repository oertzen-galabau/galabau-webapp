'use client';

import { useActionState } from 'react';
import { useNavigationPending } from '@/components/app-shell/navigation-pending-context';
import { PrimaryPendingButtonCompact } from '@/components/ui/pending-button';
import { useEffect, useState } from 'react';
import {
  saveLeaveRequestAction,
  updateLeaveRequestAction,
  type LeaveFormState,
} from '@/lib/actions/employee';
import { AppSelect } from '@/components/ui/app-select';
import type { LeaveRequest } from '@/lib/types/database';

const initialState: LeaveFormState = { error: null };

const LEAVE_TYPE_OPTIONS = [
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'krankheit', label: 'Krankheit' },
  { value: 'arzt', label: 'Arzt' },
  { value: 'amt', label: 'Amt' },
  { value: 'schule', label: 'Schule' },
  { value: 'sonstige', label: 'Sonstige' },
];

type Props = {
  request?: LeaveRequest;
  onSuccess?: () => void;
  successMessage?: string;
};

export function LeaveRequestForm({ request, onSuccess, successMessage }: Props) {
  const { refresh } = useNavigationPending();
  const isEdit = Boolean(request);
  const [state, action, pending] = useActionState(
    isEdit ? updateLeaveRequestAction : saveLeaveRequestAction,
    initialState,
  );
  const [leaveType, setLeaveType] = useState(request?.leave_type ?? 'urlaub');
  const isSonstige = leaveType === 'sonstige';
  const sonstigeReason =
    request?.leave_type === 'sonstige' ? (request.notes ?? '') : '';

  useEffect(() => {
    if (state.ok) {
      onSuccess?.();
      refresh();
    }
  }, [state.ok, refresh, onSuccess]);

  return (
    <form action={action} className="input-form">
      {isEdit && request && <input type="hidden" name="id" value={request.id} />}
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="form-feedback form-feedback--success">
          {successMessage ?? (isEdit ? 'Antrag wurde gespeichert.' : 'Antrag wurde eingereicht.')}
        </p>
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
              defaultValue={sonstigeReason}
              placeholder="z. B. Umzug, Hochzeit …"
              disabled={pending}
              aria-required="true"
            />
          </label>
        )}
        <label>
          Von
          <input
            type="date"
            name="start_date"
            required
            defaultValue={request?.start_date}
            disabled={pending}
          />
        </label>
        <label>
          Bis
          <input
            type="date"
            name="end_date"
            required
            defaultValue={request?.end_date}
            disabled={pending}
          />
        </label>
      </div>
      {!isSonstige && (
        <details className="input-form-extra">
          <summary>Notiz</summary>
          <div className="input-form-extra-grid">
            <label className="input-form-span-full">
              Notiz
              <textarea
                name="notes"
                rows={2}
                defaultValue={request?.leave_type !== 'sonstige' ? (request?.notes ?? '') : ''}
                disabled={pending}
              />
            </label>
          </div>
        </details>
      )}
      <div className="input-form-actions">
        <PrimaryPendingButtonCompact
          type="submit"
          pending={pending}
          pendingLabel={isEdit ? 'Wird gespeichert …' : 'Wird eingereicht …'}
        >
          {isEdit ? 'Speichern' : 'Einreichen'}
        </PrimaryPendingButtonCompact>
      </div>
    </form>
  );
}
