import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { inviteEmployee } from '@/lib/actions/admin';
import { AppSelect } from '@/components/ui/app-select';

export default async function TeamPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'team.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const supabase = await createClient();
  const [{ data: members }, { data: tenantRoles }] = await Promise.all([
    supabase.from('profiles').select('*, tenant_roles(name)').order('last_name'),
    supabase.from('tenant_roles').select('*').order('sort_order'),
  ]);

  const canInvite = canAccess(ctx, 'team.invite');

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Verwaltung</span>
          <h1>Team & Mitarbeiter</h1>
          <p>Mitarbeiter verwalten, Rollen zuweisen und Details einsehen.</p>
        </div>
      </div>

      {canInvite && (
        <section className="panel form-panel">
          <h2>Mitarbeiter anlegen</h2>
          <form action={inviteEmployee} className="input-form">
            <div className="input-form-core">
              <label>Vorname<input name="first_name" required /></label>
              <label>Nachname<input name="last_name" required /></label>
              <label>E-Mail<input name="email" type="email" required /></label>
              <label>Rolle
                <AppSelect
                  name="tenant_role_id"
                  required
                  allowEmpty={false}
                  options={(tenantRoles ?? []).map((role) => ({ value: role.id, label: role.name }))}
                />
              </label>
              <label>Startpasswort<input name="password" type="password" required minLength={8} /></label>
            </div>
            <div className="input-form-actions">
              <button type="submit" className="primary-button primary-button--compact">Anlegen</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel team-list team-list--links" style={{ marginTop: 16 }}>
        {(members ?? []).map((member) => {
          const roleName = (member.tenant_roles as { name: string } | null)?.name ?? '—';
          return (
            <Link href={`/app/team/${member.id}`} className="team-row team-row--link" key={member.id}>
              <span className="person-avatar">{member.first_name[0]}{member.last_name[0]}</span>
              <span>
                <strong>{member.first_name} {member.last_name}</strong>
                <small>{roleName}</small>
              </span>
              <span className="team-location">
                <i className={member.is_active ? 'active' : ''} />
                {member.email}
              </span>
              <span className={`status-badge ${member.is_active ? 'active' : 'travel'}`}>
                {member.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </Link>
          );
        })}
      </section>
    </>
  );
}
