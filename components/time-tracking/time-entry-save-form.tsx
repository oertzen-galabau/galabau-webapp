'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onSuccess?.();
    }
  }, [state.ok, router, onSuccess]);

  return (
    <form action={formAction} className="input-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {hiddenFields}
      <TimeEntryFormFields {...fields} />
    </form>
  );
}
