'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { saveSiteAction, type SiteFormState } from '@/lib/actions/admin';
import { AppSelect } from '@/components/ui/app-select';
import type { ForemanOption } from '@/lib/sites/foremen-options';

const initialState: SiteFormState = { error: null };

type Props = {
  foremanOptions: ForemanOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function SiteCreateForm({ foremanOptions, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveSiteAction, initialState);

  useEffect(() => {
    if (!state.ok || state.error) return;
    router.refresh();
    onSuccess?.();
  }, [state.ok, state.error, onSuccess, router]);

  return (
    <form action={action} className="input-form">
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && !state.error && !onSuccess && (
        <p className="form-feedback form-feedback--success">Baustelle wurde angelegt.</p>
      )}
      <div className="input-form-core">
        <label>
          Name
          <input name="name" required disabled={pending} />
        </label>
        <label>
          Kunde
          <input name="client_name" disabled={pending} />
        </label>
        <label className="input-form-span-full">
          Verantwortlicher Vorarbeiter
          <AppSelect
            name="responsible_user_id"
            allowEmpty
            placeholder="— optional —"
            options={foremanOptions}
            disabled={pending}
          />
        </label>
        <label>
          Straße mit Nr.
          <input name="street" disabled={pending} />
        </label>
        <label>
          PLZ
          <input name="zip_code" disabled={pending} />
        </label>
        <label>
          Ort
          <input name="city" disabled={pending} />
        </label>
      </div>
      <details className="input-form-extra">
        <summary>Anfahrt & Notizen</summary>
        <div className="input-form-extra-grid">
          <label className="input-form-span-2">
            Anfahrt
            <textarea name="directions" rows={2} disabled={pending} />
          </label>
          <label className="input-form-span-2">
            Notizen
            <textarea name="notes" rows={2} disabled={pending} />
          </label>
        </div>
      </details>
      <div className={onCancel ? 'dialog-actions' : 'input-form-actions'}>
        {onCancel ? (
          <button type="button" className="text-button" onClick={onCancel} disabled={pending}>
            Abbrechen
          </button>
        ) : null}
        <button
          type="submit"
          className={onCancel ? 'primary-button' : 'primary-button primary-button--compact'}
          disabled={pending}
        >
          {pending ? 'Wird angelegt…' : 'Anlegen'}
        </button>
      </div>
    </form>
  );
}
