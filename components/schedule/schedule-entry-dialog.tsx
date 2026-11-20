'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
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
import { findEquipmentUsageOnPlanDates } from '@/lib/schedule/equipment-day-exclusive';
import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import { equipmentScheduleLabel } from '@/lib/equipment/labels';
import { partnerOptionLabel } from '@/lib/partners/kind';
import { partnerSettingsListPath } from '@/lib/partners/paths';
import type { LeaveDay } from '@/lib/schedule/conflicts';
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
  leaveDays: LeaveDay[];
  subcontractors: ScheduleSubcontractorOption[];
  equipment: SchedulePlanData['equipment'];
  entries: SchedulePlanData['entries'];
  defaultSiteId?: string;
  defaultDay?: string;
  weekDays?: string[];
  /** Nur ansehen (Mitarbeiter ohne schedule.manage) */
  readOnly?: boolean;
};

export function ScheduleEntryDialog({
  open,
  onClose,
  entry,
  sites,
  employees,
  workAreas,
  leaveDays,
  subcontractors,
  equipment,
  entries,
  defaultSiteId,
  defaultDay,
  weekDays,
  readOnly = false,
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
  const [planDates, setPlanDates] = useState<string[]>(() => [...initialPlanDays]);

  useEffect(() => {
    setPlanDates([...initialPlanDays]);
  }, [formKey, initialPlanDays.join(',')]);

  const equipmentPlanDates = planDates.length ? planDates : initialPlanDays;
  const excludeEntryId = entry?.id ?? null;

  function handleSubmit(formData: FormData) {
    if (readOnly) return;
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
    if (readOnly || !entry) return;
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

  const fieldsDisabled = pending || readOnly;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={readOnly ? 'Einsatz' : entry ? 'Einsatz bearbeiten' : 'Neuer Einsatz'}
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
            <select name="site_id" required disabled={fieldsDisabled} defaultValue={entry?.site_id ?? defaultSiteId ?? ''}>
              <option value="" disabled>Bitte wählen</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <ScheduleEntryDayPicker
            initialDays={initialPlanDays}
            selectedDays={planDates}
            onSelectedDaysChange={entry || readOnly ? undefined : setPlanDates}
            readOnly={Boolean(entry) || readOnly}
            disabled={fieldsDisabled}
          />
          <label>
            Von (Uhrzeit)
            <input
              type="time"
              name="start_time"
              disabled={fieldsDisabled}
              defaultValue={entry?.start_time ?? '07:00'}
            />
          </label>
          <label>
            Bis (Uhrzeit)
            <input
              type="time"
              name="end_time"
              disabled={fieldsDisabled}
              defaultValue={entry?.end_time ?? '16:00'}
            />
          </label>
        </div>

        <div className="schedule-entry-form-section">
          <p className="input-form-section-title">Mitarbeiter</p>
          {readOnly ? (
            entry?.members.length ? (
              <ul className="schedule-entry-readonly-members">
                {entry.members.map((m) => {
                  const name = `${m.first_name} ${m.last_name}`.trim();
                  const isForeman = entry.foreman_user_id === m.user_id;
                  return (
                    <li key={m.user_id}>
                      {name}
                      {isForeman ? ' (Vorarbeiter)' : ''}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">Keine Mitarbeiter zugewiesen.</p>
            )
          ) : (
            <>
              <p className="muted schedule-entry-foreman-hint">
                Der gewählte Vorarbeiter ist für den Tagesbericht an diesem Tag verantwortlich.
              </p>
              <ScheduleMemberPicker
                key={formKey}
                employees={employees}
                workAreas={workAreas}
                planDates={planDates.length ? planDates : initialPlanDays}
                leaveDays={leaveDays}
                initialSelectedIds={initialMemberIds}
                initialForemanId={entry?.foreman_user_id ?? null}
                disabled={fieldsDisabled}
              />
            </>
          )}
        </div>

        </div>

        <div hidden={activeTab !== 'equipment'} className="schedule-entry-tab-panel">
        <div className="schedule-entry-form-section">
          <p className="input-form-section-title">Fahrzeuge & Geräte</p>
          {readOnly ? (
            entry?.equipment.length ? (
              <ul className="schedule-entry-readonly-equipment">
                {entry.equipment.map((item) => (
                  <li key={item.equipment_id}>{equipmentScheduleLabel(item)}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Keine Fahrzeuge/Geräte für diesen Einsatz.</p>
            )
          ) : equipment.length === 0 ? (
            <p className="muted">
              Keine Fahrzeuge/Geräte in der Stammliste.{' '}
              <Link href={partnerSettingsListPath('fahrzeuge')}>Stammdaten pflegen</Link>
            </p>
          ) : (
            <div className="input-form-checkboxes">
              {equipment.map((item) => {
                const usageElsewhere = findEquipmentUsageOnPlanDates(
                  entries,
                  equipmentPlanDates,
                  item.id,
                  excludeEntryId,
                );
                const blocked = Boolean(usageElsewhere);
                return (
                  <label
                    key={item.id}
                    className="input-form-checkbox"
                  >
                    <input
                      type="checkbox"
                      name="equipment_id[]"
                      value={item.id}
                      disabled={fieldsDisabled || blocked}
                      defaultChecked={equipmentSet.has(item.id)}
                    />
                    <span>
                      {equipmentScheduleLabel(item)}
                      {usageElsewhere ? (
                        <small className="muted schedule-entry-equipment-blocked">
                          {' '}
                          — bereits: {usageElsewhere.siteName}
                        </small>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        </div>

        <div hidden={activeTab !== 'details'} className="schedule-entry-tab-panel">
        <div className="schedule-entry-form-section">
          <p className="input-form-section-title">Externe / Subunternehmer</p>
          {subcontractors.length === 0 ? (
            <p className="muted">
              {readOnly ? (
                'Keine Subunternehmer hinterlegt.'
              ) : (
                <>
                  Keine Subunternehmer in der Stammliste.{' '}
                  <Link href={partnerSettingsListPath('subunternehmer')}>Geschäftspartner pflegen</Link>
                </>
              )}
            </p>
          ) : (
            <div className="input-form-checkboxes">
              {subcontractors.map((p) => (
                <label key={p.id} className="input-form-checkbox">
                  <input
                    type="checkbox"
                    name="external_partner_id[]"
                    value={p.id}
                    disabled={fieldsDisabled}
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
              disabled={fieldsDisabled}
              defaultValue={externalInitial.extra}
              placeholder="z. B. Firma +2 oder Freitext"
            />
          </label>
        </div>

        <div className="input-form-core">
          <label className="input-form-span-full">
            Notiz / Arbeitsauftrag
            <textarea name="notes" rows={3} disabled={fieldsDisabled} defaultValue={entry?.notes ?? ''} />
          </label>
        </div>
        </div>
        </div>

        <div className="dialog-actions schedule-entry-dialog-actions">
          {readOnly ? (
            <button type="button" className="primary-button primary-button--compact" onClick={onClose}>
              Schließen
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </form>
    </AppDialog>
  );
}
