'use client';

import { useActionState } from 'react';
import { updateEmployeeProfileAction, type SiteFormState } from '@/lib/actions/admin';
import { updateOwnProfile } from '@/lib/actions/profile';
import { AppSelect } from '@/components/ui/app-select';
import { WorkAreaSelect } from '@/components/team/work-area-select';
import type { EmployeeDetailMode } from '@/lib/team/employee-detail-data';
import type { Profile, TenantWorkArea } from '@/lib/types/database';

const SALUTATION_OPTIONS = [
  { value: 'Herr', label: 'Herr' },
  { value: 'Frau', label: 'Frau' },
  { value: 'Divers', label: 'Divers' },
];

const adminInitialState: SiteFormState = { error: null };

type Props = {
  member: Profile;
  mode: EmployeeDetailMode;
  workAreas: Pick<TenantWorkArea, 'id' | 'name' | 'is_active'>[];
  /** Im Self-Modus: Berechtigung eigene Stammdaten zu bearbeiten */
  canEditPersonal: boolean;
  /** Im Admin-Modus: team.edit_profile */
  editableAdmin: boolean;
};

export function EmployeeStammdatenForm({
  member,
  mode,
  workAreas,
  canEditPersonal,
  editableAdmin,
}: Props) {
  const [state, adminAction, pending] = useActionState(updateEmployeeProfileAction, adminInitialState);

  const isSelf = mode === 'self';
  const showAdminForm = !isSelf && editableAdmin;

  if (isSelf) {
    return (
      <div className="employee-stammdaten-form-root">
        <section className="input-form-section">
          <p className="input-form-section-title">Anstellung</p>
          <div className="input-form-core employee-stammdaten-grid--employment">
            <label>
              Personalnummer
              <input name="personnel_number" defaultValue={member.personnel_number ?? ''} disabled />
            </label>
            <label>
              Eintrittsdatum
              <input name="entry_date" type="date" defaultValue={member.entry_date ?? ''} disabled />
            </label>
            <label>
              Austrittsdatum
              <input name="exit_date" type="date" defaultValue={member.exit_date ?? ''} disabled />
            </label>
          </div>
        </section>

        <section className="input-form-section" style={{ marginTop: 16 }}>
          <p className="input-form-section-title">Persönliche Daten</p>
          {!canEditPersonal && <p className="muted">Keine Berechtigung zum Bearbeiten.</p>}
          <form action={updateOwnProfile} className="input-form">
            <div className="input-form-core">
              <label>
                Anrede
                <AppSelect
                  name="salutation"
                  defaultValue={member.salutation ?? ''}
                  disabled={!canEditPersonal}
                  options={SALUTATION_OPTIONS}
                />
              </label>
              <label>
                Vorname
                <input name="first_name" defaultValue={member.first_name} required disabled={!canEditPersonal} />
              </label>
              <label>
                Nachname
                <input name="last_name" defaultValue={member.last_name} required disabled={!canEditPersonal} />
              </label>
              <label>
                Telefon
                <input name="phone" type="tel" defaultValue={member.phone ?? ''} disabled={!canEditPersonal} />
              </label>
              <label className="input-form-span-full">
                Straße
                <input name="address" defaultValue={member.address ?? ''} disabled={!canEditPersonal} />
              </label>
              <label>
                PLZ
                <input name="zip_code" defaultValue={member.zip_code ?? ''} disabled={!canEditPersonal} />
              </label>
              <label>
                Ort
                <input name="city" defaultValue={member.city ?? ''} disabled={!canEditPersonal} />
              </label>
              <label>
                Geburtstag
                <input name="birthday" type="date" defaultValue={member.birthday ?? ''} disabled={!canEditPersonal} />
              </label>
            </div>
            {canEditPersonal && (
              <div className="input-form-actions">
                <button type="submit" className="primary-button primary-button--compact">
                  Speichern
                </button>
              </div>
            )}
          </form>
        </section>

        <section className="input-form-section" style={{ marginTop: 16 }}>
          <p className="input-form-section-title">Kontakt</p>
          <div className="input-form-core employee-stammdaten-grid--contact">
            <label>
              E-Mail
              <input name="email_display" type="email" defaultValue={member.email} readOnly disabled />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 'var(--text-caption)' }}>
            E-Mail-Änderung über den Tab „Sicherheit“.
          </p>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Tätigkeit & Einsatzplan</p>
          <div className="input-form-core employee-stammdaten-grid--job">
            <label>
              Berufbezeichnung
              <input name="job_title_ro" defaultValue={member.job_title ?? ''} disabled />
            </label>
            <label>
              Bereich (Einsatzplan)
              <WorkAreaSelect areas={workAreas} defaultValue={member.work_area_id} disabled />
            </label>
          </div>
          <label className="input-form-checkbox employee-stammdaten-checkbox">
            <input type="checkbox" name="is_site_manager_ro" defaultChecked={member.is_site_manager === true} disabled />
            Bauleiter
          </label>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Abrechnung</p>
          <label className="input-form-checkbox employee-stammdaten-checkbox">
            <input
              type="checkbox"
              name="payroll_lkw_hours_ro"
              defaultChecked={(member.payroll_flags as { lkw_hours?: boolean })?.lkw_hours === true}
              disabled
            />
            LKW-Std berechtigt (Buchung 1001)
          </label>
        </section>
      </div>
    );
  }

  return (
    <form action={showAdminForm ? adminAction : undefined} className="input-form employee-stammdaten-form">
      <input type="hidden" name="user_id" value={member.id} />
      {showAdminForm && state.error && <p className="form-error">{state.error}</p>}
      {showAdminForm && state.ok && !state.error && (
        <p className="form-feedback form-feedback--success">Stammdaten gespeichert.</p>
      )}

      <div className="employee-stammdaten-sections">
        <section className="input-form-section">
          <p className="input-form-section-title">Anstellung</p>
          <div className="input-form-core employee-stammdaten-grid--employment">
            <label>
              Personalnummer
              <input name="personnel_number" defaultValue={member.personnel_number ?? ''} disabled={!editableAdmin} />
            </label>
            <label>
              Eintrittsdatum
              <input name="entry_date" type="date" defaultValue={member.entry_date ?? ''} disabled={!editableAdmin} />
            </label>
            <label>
              Austrittsdatum
              <input name="exit_date" type="date" defaultValue={member.exit_date ?? ''} disabled={!editableAdmin} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Name</p>
          <div className="input-form-core employee-stammdaten-grid--name">
            <label>
              Anrede
              <AppSelect
                name="salutation"
                defaultValue={member.salutation ?? ''}
                disabled={!editableAdmin}
                options={SALUTATION_OPTIONS}
              />
            </label>
            <label>
              Vorname
              <input name="first_name" defaultValue={member.first_name} required disabled={!editableAdmin} />
            </label>
            <label>
              Nachname
              <input name="last_name" defaultValue={member.last_name} required disabled={!editableAdmin} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Kontakt</p>
          <div className="input-form-core employee-stammdaten-grid--contact">
            <label>
              E-Mail
              <input name="email" type="email" defaultValue={member.email} required disabled={!editableAdmin} />
            </label>
            <label>
              Telefon
              <input name="phone" type="tel" defaultValue={member.phone ?? ''} disabled={!editableAdmin} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Adresse</p>
          <div className="input-form-core employee-stammdaten-grid--address">
            <label className="input-form-span-full">
              Straße
              <input name="address" defaultValue={member.address ?? ''} disabled={!editableAdmin} />
            </label>
            <label>
              PLZ
              <input name="zip_code" defaultValue={member.zip_code ?? ''} disabled={!editableAdmin} />
            </label>
            <label>
              Ort
              <input name="city" defaultValue={member.city ?? ''} disabled={!editableAdmin} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Tätigkeit & Einsatzplan</p>
          <div className="input-form-core employee-stammdaten-grid--job">
            <label>
              Berufbezeichnung
              <input
                name="job_title"
                defaultValue={member.job_title ?? ''}
                disabled={!editableAdmin}
                placeholder="z.B. Vorarbeiter, Gärtner"
              />
            </label>
            <label>
              Bereich (Einsatzplan)
              <WorkAreaSelect areas={workAreas} defaultValue={member.work_area_id} disabled={!editableAdmin} />
            </label>
          </div>
          <label className="input-form-checkbox employee-stammdaten-checkbox">
            <input
              type="checkbox"
              name="is_site_manager"
              defaultChecked={member.is_site_manager === true}
              disabled={!editableAdmin}
            />
            Bauleiter
          </label>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--text-caption)' }}>
            Kann auf Baustellen als Bauleiter gewählt werden.
          </p>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Persönlich</p>
          <div className="input-form-core employee-stammdaten-grid--personal">
            <label>
              Geburtstag
              <input name="birthday" type="date" defaultValue={member.birthday ?? ''} disabled={!editableAdmin} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Abrechnung</p>
          <label className="input-form-checkbox employee-stammdaten-checkbox">
            <input
              type="checkbox"
              name="payroll_lkw_hours"
              defaultChecked={(member.payroll_flags as { lkw_hours?: boolean })?.lkw_hours === true}
              disabled={!editableAdmin}
            />
            LKW-Std berechtigt (Buchung 1001)
          </label>
        </section>
      </div>

      {showAdminForm && (
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            {pending ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      )}
      {!editableAdmin && (
        <p className="muted" style={{ marginTop: 12 }}>
          Nur Lesezugriff.
        </p>
      )}
    </form>
  );
}
