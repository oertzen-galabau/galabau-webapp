import { updateOwnProfile } from '@/lib/actions/profile';
import type { Profile } from '@/lib/types/database';
import { AppSelect } from '@/components/ui/app-select';

type Props = {
  profile: Profile;
  editable: boolean;
};

export function ProfilePersonalForm({ profile, editable }: Props) {
  return (
    <section className="panel form-panel employee-section">
      <h2>Persönliche Daten</h2>
      {!editable && <p className="muted">Keine Berechtigung zum Bearbeiten.</p>}
      <form action={updateOwnProfile} className="input-form">
        <div className="input-form-core">
          <label>Anrede
            <AppSelect
              name="salutation"
              defaultValue={profile.salutation ?? ''}
              disabled={!editable}
              options={[
                { value: 'Herr', label: 'Herr' },
                { value: 'Frau', label: 'Frau' },
                { value: 'Divers', label: 'Divers' },
              ]}
            />
          </label>
          <label>Vorname
            <input name="first_name" defaultValue={profile.first_name} required disabled={!editable} />
          </label>
          <label>Nachname
            <input name="last_name" defaultValue={profile.last_name} required disabled={!editable} />
          </label>
          <label>Telefon
            <input name="phone" type="tel" defaultValue={profile.phone ?? ''} disabled={!editable} />
          </label>
          <label>Straße
            <input name="address" defaultValue={profile.address ?? ''} disabled={!editable} />
          </label>
          <label>PLZ
            <input name="zip_code" defaultValue={profile.zip_code ?? ''} disabled={!editable} />
          </label>
          <label>Ort
            <input name="city" defaultValue={profile.city ?? ''} disabled={!editable} />
          </label>
          <label>Geburtstag
            <input name="birthday" type="date" defaultValue={profile.birthday ?? ''} disabled={!editable} />
          </label>
        </div>
        {editable && (
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Speichern</button>
          </div>
        )}
      </form>
    </section>
  );
}
