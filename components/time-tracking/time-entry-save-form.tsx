'use client';

import { useActionState, useEffect } from 'react';
import { useNavigationPending } from '@/components/app-shell/navigation-pending-context';
import { TimeEntryFormFields } from '@/components/time-tracking/time-entry-form-fields';
import type { TimeEntryFormState } from '@/lib/actions/employee';

type FieldsProps = React.ComponentProps<typeof TimeEntryFormFields>;

type Props = FieldsProps & {
  action: (prev: TimeEntryFormState | null, formData: FormData) => Promise<TimeEntryFormState>;
  hiddenFields?: React.ReactNode;
  onSuccess?: () => void;
};

const initialState: TimeEntryFormState = { error: null };

export function TimeEntrySaveForm({ action, hiddenFields, onSuccess, ...fields }: Props) {
  const { refresh } = useNavigationPending();
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) {
      refresh();
      onSuccess?.();
    }
  }, [state.ok, refresh, onSuccess]);

  return (
    <form action={formAction} className="input-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {hiddenFields}
      <TimeEntryFormFields {...fields} pending={pending} />
    </form>
  );
}
