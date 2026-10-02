'use client';

import { useActionState } from 'react';
import { saveSiteAction, type SiteFormState } from '@/lib/actions/admin';
import { AppSelect } from '@/components/ui/app-select';
import type { ForemanOption } from '@/lib/sites/foremen-options';

const initialState: SiteFormState = { error: null };

type Props = {
  foremanOptions: ForemanOption[];
};

export function SiteCreateForm({ foremanOptions }: Props) {
  const [state, action, pending] = useActionState(saveSiteAction, initialState);

  return (
    <form action={action} className="input-form">
      {state.error && <p className="form-error">{state.error}</p>}
      {state.ok && !state.error && (
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
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
          {pending ? 'Wird angelegt…' : 'Anlegen'}
        </button>
      </div>
    </form>
  );
}
