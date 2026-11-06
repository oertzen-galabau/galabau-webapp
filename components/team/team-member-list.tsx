'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MemberAccessBadge } from '@/components/team/member-access-badge';
import { TeamMemberRowActions } from '@/components/team/team-member-row-actions';
import type { Profile } from '@/lib/types/database';

export type TeamMemberListItem = Profile & {
  tenant_roles: { name: string } | null;
};

type Props = {
  members: TeamMemberListItem[];
  currentUserId: string;
  showRowActions: boolean;
  canDeactivate: boolean;
  canDelete: boolean;
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('de-DE');
}

function memberMatchesQuery(member: TeamMemberListItem, q: string) {
  if (!q) return true;
  const first = normalizeSearch(member.first_name);
  const last = normalizeSearch(member.last_name);
  const full = `${first} ${last}`.trim();
  const email = normalizeSearch(member.email ?? '');
  return (
    first.includes(q) ||
    last.includes(q) ||
    full.includes(q) ||
    email.includes(q)
  );
}

export function TeamMemberList({
  members,
  currentUserId,
  showRowActions,
  canDeactivate,
  canDelete,
}: Props) {
  const [search, setSearch] = useState('');

  const query = useMemo(() => normalizeSearch(search), [search]);

  const filtered = useMemo(
    () => members.filter((m) => memberMatchesQuery(m, query)),
    [members, query],
  );

  return (
    <>
      <div style={{ marginTop: 16, marginBottom: 12 }}>
        <label className="leave-calendar-search">
          <span className="sr-only">Mitarbeiter suchen</span>
          <input
            type="search"
            placeholder="Vor- oder Nachname suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Mitarbeiter nach Vorname, Nachname oder E-Mail filtern"
            autoComplete="off"
          />
        </label>
      </div>

      <section
        className={`panel team-list team-list--links${showRowActions ? ' team-list--with-actions' : ''}`}
      >
        {filtered.length === 0 ? (
          <p className="muted" style={{ margin: '12px 16px' }}>
            Keine Mitarbeiter für diese Suche.
          </p>
        ) : (
          filtered.map((member) => {
            const roleName = member.tenant_roles?.name ?? '—';
            const fn = member.first_name?.[0] ?? '?';
            const ln = member.last_name?.[0] ?? '?';
            return (
              <div className="team-row team-row--list" key={member.id}>
                <Link href={`/app/team/${member.id}`} className="team-row-main">
                  <span className="person-avatar">
                    {fn}
                    {ln}
                  </span>
                  <span className="team-row-person">
                    <strong>
                      {member.first_name} {member.last_name}
                    </strong>
                    <small>{roleName}</small>
                  </span>
                  <span className="team-location">
                    <i className={member.is_active ? 'active' : ''} />
                    {member.email}
                  </span>
                  <span className="team-row-status">
                    <MemberAccessBadge
                      is_active={member.is_active}
                      must_change_password={member.must_change_password}
                    />
                  </span>
                </Link>
                {showRowActions && (
                  <TeamMemberRowActions
                    memberId={member.id}
                    memberName={`${member.first_name} ${member.last_name}`}
                    isActive={member.is_active}
                    isSelf={member.id === currentUserId}
                    canDeactivate={canDeactivate}
                    canDelete={canDelete}
                  />
                )}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
