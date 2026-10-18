'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';
import {
  createScheduleEntry,
  deleteScheduleEntry,
  updateScheduleEntry,
} from '@/lib/actions/schedule';
import {
  buildExternalWorkersText,
  parseExternalWorkersText,
} from '@/lib/schedule/external-workers-text';
import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import { equipmentScheduleLabel } from '@/lib/equipment/labels';
import { partnerOptionLabel } from '@/lib/partners/kind';
import { partnerSettingsListPath } from '@/lib/partners/paths';
import type { SchedulePlanData } from '@/lib/schedule/load-plan-data';
import { todayIsoInBerlin } from '@/lib/schedule/week';
import { ScheduleEntryDayPicker } from '@/components/schedule/schedule-entry-day-picker';
import { ScheduleMemberPicker } from '@/components/schedule/schedule-member-picker';
import type { Site } from '@/lib/types/database';

export type ScheduleSubcontractorOption = {
  id: string;
  name: string;
  contact_person: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  entry: ScheduleEntryView | null;
  sites: Pick<Site, 'id' | 'name'>[];
  employees: SchedulePlanData['employees'];
  workAreas: SchedulePlanData['workAreas'];
  subcontractors: ScheduleSubcontractorOption[];
  equipment: SchedulePlanData['equipment'];
  defaultSiteId?: string;
  defaultDay?: string;
  weekDays?: string[];
};

export function ScheduleEntryDialog({
  open,
  onClose,
  entry,
  sites,
  employees,
  workAreas,
  subcontractors,
  equipment,
  defaultSiteId,
  defaultDay,
  weekDays,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialMemberIds = entry?.members.map((m) => m.user_id) ?? [];
  const equipmentSet = new Set(entry?.equipment.map((e) => e.equipment_id) ?? []);
  const externalInitial = useMemo(
    () => parseExternalWorkersText(entry?.external_workers_text, subcontractors),
    [entry?.external_workers_text, subcontractors],
  );
  const partnerInitialSet = new Set(externalInitial.selectedPartnerIds);
  const formKey = entry?.id ?? `new-${defaultSiteId ?? ''}-${defaultDay ?? ''}`;
  const [tabState, setTabState] = useState<{ key: string; tab: 'details' | 'equipment' }>({
    key: formKey,
    tab: 'details',
  });
  // Beim Wechsel auf einen anderen Einsatz immer mit dem ersten Tab starten.
  const activeTab = tabState.key === formKey ? tabState.tab : 'details';

  const primaryDay = entry?.start_date ?? defaultDay ?? todayIsoInBerlin();
  const initialPlanDays = entry ? [entry.start_date] : primaryDay ? [primaryDay] : [];

  function handleSubmit(formData: FormData) {
    setError(null);
    const planDate = String(formData.get('start_date') ?? '').trim();
    if (!entry && !planDate) {
      setError('Bitte mindestens einen Tag auswählen.');
      return;
    }
    const partnerIds = formData.getAll('external_partner_id[]').map(String);
    const extra = String(formData.get('external_workers_extra') ?? '');
    formData.set(
      'external_workers_text',
      buildExternalWorkersText(partnerIds, subcontractors, extra),
    );
    formData.set('start_date', planDate || entry!.start_date);
    startTransition(async () => {
      try {
        if (entry) {
          formData.set('entry_id', entry.id);
          await updateScheduleEntry(formData);
        } else {
          await createScheduleEntry(formData);
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      }
    });
  }

  function handleDelete() {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('entry_id', entry.id);
        await deleteScheduleEntry(fd);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Auf ungeplant setzen fehlgeschlagen');
      }
    });
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={entry ? 'Einsatz bearbeiten' : 'Neuer Einsatz'}
      panelClassName="dialog-panel--wide dialog-panel--fixed"
    >
      <form
        key={formKey}
        className="input-form schedule-entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(new FormData(e.currentTarget));
        }}
      >
        {error ? <p className="form-error">{error}</p> : null}

        <div className="schedule-entry-tabs" role="tablist" aria-label="Einsatz-Bereiche">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            className={activeTab === 'details' ? 'active' : undefined}
            onClick={() => setTabState({ key: formKey, tab: 'details' })}
          >
            Einsatz
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'equipment'}
            className={activeTab === 'equipment' ? 'active' : undefined}
            onClick={() => setTabState({ key: formKey, tab: 'equipment' })}
          >
            Fahrzeuge &amp; Geräte
          </button>
        </div>

        <div className="schedule-entry-scroll">
        <div hidden={activeTab !== 'details'} className="schedule-entry-tab-panel">
        <div className="input-form-core">
          <label className="input-form-span-full">
            Baustelle
            <select name="site_id" required disabled={pending} defaultValue={entry?.site_id ?? defaultSiteId ?? ''}>
              <option value="" disabled>Bitte wählen</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <ScheduleEntryDayPicker
            initialDays={initialPlanDays}
            readOnly={Boolean(entry)}
            disabled={pending}
          />
          <label>
            Von (Uhrzeit)
            <input
              type="time"
              name="start_time"
              disabled={pending}
              defaultValue={entry?.start_time ?? '07:00'}
            />
          </label>
          <label>
            Bis (Uhrzeit)
            <input
              type="time"
              name="end_time"
              disabled={pending}
              defaultValue={entry?.end_time ?? '16:00'}
            />
          </label>
        </div>

        <div className="schedule-entry-form-section">
          <p className="input-form-section-title">Mitarbeiter</p>
          <p className="muted schedule-entry-foreman-hint">
            Der gewählte Vorarbeiter ist für den Tagesbericht an diesem Tag verantwortlich.
          </p>
          <ScheduleMemberPicker
            key={formKey}
            employees={employees}
            workAreas={workAreas}
            initialSelectedIds={initialMemberIds}
            initialForemanId={entry?.foreman_user_id ?? null}
            disabled={pending}
          />
        </div>

        </div>

        <div hidden={activeTab !== 'equipment'} className="schedule-entry-tab-panel">
        <div className="schedule-entry-form-section">
          <p className="input-form-section-title">Fahrzeuge & Geräte</p>
          {equipment.length === 0 ? (
            <p className="muted">
              Keine Fahrzeuge/Geräte in der Stammliste.{' '}
              <Link href={partnerSettingsListPath('fahrzeuge')}>Stammdaten pflegen</Link>
            </p>
          ) : (
            <div className="input-form-checkboxes">
              {equipment.map((item) => (
                <label key={item.id} className="input-form-checkbox">
                  <input
                    type="checkbox"
                    name="equipment_id[]"
                    value={item.id}
                    disabled={pending}
                    defaultChecked={equipmentSet.has(item.id)}
                  />
                  {equipmentScheduleLabel(item)}
                </label>
              ))}
            </div>
          )}
        </div>

        </div>

        <div hidden={activeTab !== 'details'} className="schedule-entry-tab-panel">
        <div className="schedule-entry-form-section">
          <p className="input-form-section-title">Externe / Subunternehmer</p>
          {subcontractors.length === 0 ? (
            <p className="muted">
              Keine Subunternehmer in der Stammliste.{' '}
              <Link href={partnerSettingsListPath('subunternehmer')}>Geschäftspartner pflegen</Link>
            </p>
          ) : (
            <div className="input-form-checkboxes">
              {subcontractors.map((p) => (
                <label key={p.id} className="input-form-checkbox">
                  <input
                    type="checkbox"
                    name="external_partner_id[]"
                    value={p.id}
                    disabled={pending}
                    defaultChecked={partnerInitialSet.has(p.id)}
                  />
                  {partnerOptionLabel(p)}
                </label>
              ))}
            </div>
          )}
          <label className="input-form-span-full schedule-entry-external-extra">
            Zusatz (Anzahl, weitere Namen)
            <input
              name="external_workers_extra"
              disabled={pending}
              defaultValue={externalInitial.extra}
              placeholder="z. B. Firma +2 oder Freitext"
            />
          </label>
        </div>

        <div className="input-form-core">
          <label className="input-form-span-full">
            Notiz / Arbeitsauftrag
            <textarea name="notes" rows={3} disabled={pending} defaultValue={entry?.notes ?? ''} />
          </label>
        </div>
        </div>
        </div>

        <div className="dialog-actions schedule-entry-dialog-actions">
          {entry ? (
            <button
              type="button"
              className="text-button schedule-entry-dialog-delete"
              disabled={pending}
              onClick={handleDelete}
            >
              Ungeplant
            </button>
          ) : null}
          <button type="button" className="text-button schedule-entry-dialog-cancel" onClick={onClose} disabled={pending}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button primary-button--compact schedule-entry-dialog-save" disabled={pending}>
            {pending ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}
