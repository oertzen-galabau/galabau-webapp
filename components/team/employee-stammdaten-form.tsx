'use client';

import { useActionState } from 'react';
import { updateEmployeeProfileAction, type SiteFormState } from '@/lib/actions/admin';
import { AppSelect } from '@/components/ui/app-select';
import { WorkAreaSelect } from '@/components/team/work-area-select';
import type { Profile, TenantWorkArea } from '@/lib/types/database';

const SALUTATION_OPTIONS = [
  { value: 'Herr', label: 'Herr' },
  { value: 'Frau', label: 'Frau' },
  { value: 'Divers', label: 'Divers' },
];

const initialState: SiteFormState = { error: null };

type Props = {
  member: Profile;
  editable: boolean;
  workAreas: Pick<TenantWorkArea, 'id' | 'name' | 'is_active'>[];
};

export function EmployeeStammdatenForm({ member, editable, workAreas }: Props) {
  const [state, action, pending] = useActionState(updateEmployeeProfileAction, initialState);

  return (
    <form action={editable ? action : undefined} className="input-form employee-stammdaten-form">
      <input type="hidden" name="user_id" value={member.id} />
      {editable && state.error && <p className="form-error">{state.error}</p>}
      {editable && state.ok && !state.error && (
        <p className="form-feedback form-feedback--success">Stammdaten gespeichert.</p>
      )}

      <div className="employee-stammdaten-sections">
        <section className="input-form-section">
          <p className="input-form-section-title">Anstellung</p>
          <div className="input-form-core employee-stammdaten-grid--employment">
            <label>
              Personalnummer
              <input name="personnel_number" defaultValue={member.personnel_number ?? ''} disabled={!editable} />
            </label>
            <label>
              Eintrittsdatum
              <input name="entry_date" type="date" defaultValue={member.entry_date ?? ''} disabled={!editable} />
            </label>
            <label>
              Austrittsdatum
              <input name="exit_date" type="date" defaultValue={member.exit_date ?? ''} disabled={!editable} />
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
                disabled={!editable}
                options={SALUTATION_OPTIONS}
              />
            </label>
            <label>
              Vorname
              <input name="first_name" defaultValue={member.first_name} required disabled={!editable} />
            </label>
            <label>
              Nachname
              <input name="last_name" defaultValue={member.last_name} required disabled={!editable} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Kontakt</p>
          <div className="input-form-core employee-stammdaten-grid--contact">
            <label>
              E-Mail
              <input name="email" type="email" defaultValue={member.email} required disabled={!editable} />
            </label>
            <label>
              Telefon
              <input name="phone" type="tel" defaultValue={member.phone ?? ''} disabled={!editable} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Adresse</p>
          <div className="input-form-core employee-stammdaten-grid--address">
            <label className="input-form-span-full">
              Straße
              <input name="address" defaultValue={member.address ?? ''} disabled={!editable} />
            </label>
            <label>
              PLZ
              <input name="zip_code" defaultValue={member.zip_code ?? ''} disabled={!editable} />
            </label>
            <label>
              Ort
              <input name="city" defaultValue={member.city ?? ''} disabled={!editable} />
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
                disabled={!editable}
                placeholder="z.B. Vorarbeiter, Gärtner"
              />
            </label>
            <label>
              Bereich (Einsatzplan)
              <WorkAreaSelect areas={workAreas} defaultValue={member.work_area_id} disabled={!editable} />
            </label>
          </div>
        </section>

        <section className="input-form-section">
          <p className="input-form-section-title">Persönlich</p>
          <div className="input-form-core employee-stammdaten-grid--personal">
            <label>
              Geburtstag
              <input name="birthday" type="date" defaultValue={member.birthday ?? ''} disabled={!editable} />
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
              disabled={!editable}
            />
            LKW-Std berechtigt (Buchung 1001)
          </label>
        </section>
      </div>

      {editable && (
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            {pending ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      )}
    </form>
  );
}
