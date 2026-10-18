'use client';

import { useTransition } from 'react';
import { setWorkAreaScheduleAssignable } from '@/lib/actions/work-areas';

type Props = {
  areaId: string;
  checked: boolean;
  disabled?: boolean;
};

export function WorkAreaScheduleCheckbox({ areaId, checked, disabled }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="work-area-row-schedule-form"
      action={(formData) => {
        startTransition(() => setWorkAreaScheduleAssignable(formData));
      }}
    >
      <input type="hidden" name="id" value={areaId} />
      <label className="input-form-checkbox work-area-row-schedule">
        <input
          type="checkbox"
          name="schedule_assignable"
          defaultChecked={checked}
          disabled={disabled || pending}
          onChange={(event) => {
            event.currentTarget.form?.requestSubmit();
          }}
        />
        Einsatzplan
      </label>
    </form>
  );
}
