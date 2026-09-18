import type { Profile } from '@/lib/types/database';

type Props = {
  profile: Profile;
  roleName: string;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE').format(new Date(value));
}

export function ProfileWorkReadonly({ profile, roleName }: Props) {
  return (
    <section className="panel form-panel employee-section">
      <h2>Arbeitsdaten</h2>
      <p className="muted">Änderungen an diesen Feldern erfolgen nur durch die Verwaltung.</p>
      <dl className="profile-readonly-grid">
        <div>
          <dt>Personalnummer</dt>
          <dd>{profile.personnel_number ?? '—'}</dd>
        </div>
        <div>
          <dt>Stellenbezeichnung</dt>
          <dd>{profile.job_title ?? '—'}</dd>
        </div>
        <div>
          <dt>Rolle</dt>
          <dd>{roleName}</dd>
        </div>
        <div>
          <dt>Eintrittsdatum</dt>
          <dd>{formatDate(profile.entry_date)}</dd>
        </div>
        <div>
          <dt>Austrittsdatum</dt>
          <dd>{formatDate(profile.exit_date)}</dd>
        </div>
      </dl>
    </section>
  );
}
