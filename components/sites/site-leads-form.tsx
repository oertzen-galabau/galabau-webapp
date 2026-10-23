'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { updateSiteLeadsAction } from '@/lib/actions/site-team';
import type { SiteFormState } from '@/lib/actions/admin';
import { AppSelect } from '@/components/ui/app-select';
import type { ForemanOption } from '@/lib/sites/foremen-options';

const initialState: SiteFormState = { error: null };

type Props = {
  siteId: string;
  siteManagerUserId: string | null;
  foremanUserId: string | null;
  siteManagerOptions: ForemanOption[];
  foremanOptions: ForemanOption[];
  canEdit: boolean;
};

export function SiteLeadsForm({
  siteId,
  siteManagerUserId,
  foremanUserId,
  siteManagerOptions,
  foremanOptions,
  canEdit,
}: Props) {
  const [state, action, isActionPending] = useActionState(updateSiteLeadsAction, initialState);
  const [isSaving, startTransition] = useTransition();
  const pending = isActionPending || isSaving;
  const [siteManagerId, setSiteManagerId] = useState(siteManagerUserId ?? '');
  const [foremanId, setForemanId] = useState(foremanUserId ?? '');

  useEffect(() => {
    setSiteManagerId(siteManagerUserId ?? '');
    setForemanId(foremanUserId ?? '');
  }, [siteManagerUserId, foremanUserId]);

  function saveLeads(manager: string, foreman: string) {
    if (!canEdit || pending) return;
    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('site_manager_user_id', manager);
    fd.set('responsible_user_id', foreman);
    startTransition(() => {
      action(fd);
    });
  }

  return (
    <div className="input-form site-leads-form">
      {canEdit && state.error && <p className="form-error">{state.error}</p>}
      {canEdit && state.ok && !state.error && !pending && (
        <p className="form-feedback form-feedback--success">Gespeichert.</p>
      )}
      {canEdit && pending && <p className="muted site-leads-form-status">Speichern…</p>}
      <div className="input-form-core site-leads-form-grid">
        <label>
          Bauleiter
          <AppSelect
            name="site_manager_user_id"
            value={siteManagerId}
            onValueChange={(value) => {
              setSiteManagerId(value);
              saveLeads(value, foremanId);
            }}
            allowEmpty
            placeholder="— optional —"
            disabled={!canEdit || pending}
            options={siteManagerOptions}
          />
        </label>
        <label>
          Vorarbeiter
          <AppSelect
            name="responsible_user_id"
            value={foremanId}
            onValueChange={(value) => {
              setForemanId(value);
              saveLeads(siteManagerId, value);
            }}
            allowEmpty
            placeholder="— optional —"
            disabled={!canEdit || pending}
            options={foremanOptions}
          />
        </label>
      </div>
    </div>
  );
}
