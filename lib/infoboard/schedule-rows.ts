import {
  formatMemberShortName,
  sortedEntryTeamDisplay,
} from '@/lib/schedule/entry-member-labels';
import type { ScheduleRow, ScheduleTeamLine } from '@/lib/infoboard/types';

type ProfileRef = { first_name: string; last_name: string };
type SiteRef = { name: string; address: string | null };

export type InfoboardScheduleEntryRaw = {
  id: string;
  start_time: string;
  end_time: string;
  site_id: string;
  foreman_user_id: string | null;
  external_workers_text?: string | null;
  sites: unknown;
  schedule_entry_members?: { user_id: string; profiles: unknown }[] | null;
};

export type InfoboardAppointmentRaw = {
  id: string;
  title: string | null;
  appointment_at: string;
  site_id: string;
  sites: unknown;
};

function asProfile(value: unknown): ProfileRef | null {
  if (!value || Array.isArray(value)) return null;
  const profile = value as ProfileRef;
  return profile.first_name ? profile : null;
}

function asSiteRef(value: unknown): SiteRef | null {
  if (!value || Array.isArray(value)) return null;
  const site = value as SiteRef;
  return site.name ? site : null;
}

function memberInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  const combined = `${first}${last}`.toUpperCase();
  return combined || '?';
}

function teamLinesFromEntry(entry: InfoboardScheduleEntryRaw): ScheduleTeamLine[] {
  const members = (entry.schedule_entry_members ?? [])
    .map((row) => {
      const profile = asProfile(row.profiles);
      if (!profile) return null;
      return {
        user_id: row.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        leader_code: null,
      };
    })
    .filter(
      (m): m is { user_id: string; first_name: string; last_name: string; leader_code: null } =>
        m != null,
    );

  const foremanId = entry.foreman_user_id;
  const foremanMember = foremanId ? members.find((m) => m.user_id === foremanId) : null;
  const display = sortedEntryTeamDisplay({
    members,
    foreman: foremanMember
      ? {
          id: foremanMember.user_id,
          first_name: foremanMember.first_name,
          last_name: foremanMember.last_name,
          leader_code: null,
        }
      : null,
    foreman_user_id: foremanId,
    external_workers_text: entry.external_workers_text ?? null,
  });

  const lines: ScheduleTeamLine[] = [];
  for (const line of display.members) {
    const member = members.find((m) => formatMemberShortName(m) === line.text);
    lines.push({
      text: line.text,
      isForeman: line.isForeman,
      initials: member
        ? memberInitials(member.first_name, member.last_name)
        : initialsFromShortName(line.text),
    });
  }
  for (const ext of display.external) {
    const chunk = ext.trim().split(/\s+/)[0] ?? ext;
    lines.push({
      text: ext,
      initials: chunk.slice(0, 2).toUpperCase() || '?',
    });
  }
  return lines;
}

function initialsFromShortName(shortName: string): string {
  const parts = shortName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return memberInitials(parts[0]!, parts[1]!.replace(/\.$/, '') || parts[1]!);
  }
  return shortName.slice(0, 2).toUpperCase() || '?';
}

export function formatScheduleDayLabel(dayIso: string): string {
  const [year, month, day] = dayIso.split('-').map(Number);
  const noonUtc = new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0));
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(noonUtc);
}

function formatAppointmentTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

function appointmentTone(iso: string): ScheduleRow['tone'] {
  const now = Date.now();
  const time = new Date(iso).getTime();
  const diffHours = (time - now) / (1000 * 60 * 60);
  if (diffHours <= 0 && diffHours > -4) return 'active';
  if (diffHours > 0 && diffHours <= 2) return 'travel';
  return 'planned';
}

export function buildScheduleRowsForDay(options: {
  dayIso: string;
  entries: InfoboardScheduleEntryRaw[];
  appointments: InfoboardAppointmentRaw[];
  assignment: { site_id: string | null; sites: unknown } | null;
  userId: string;
  canSeeAll: boolean;
  foremanLogKeys?: Set<string>;
  includeMissingReport: boolean;
  emptyMessage: string;
}): ScheduleRow[] {
  const {
    dayIso,
    entries,
    appointments,
    assignment,
    userId,
    canSeeAll,
    foremanLogKeys,
    includeMissingReport,
  } = options;

  const rows: ScheduleRow[] = [];

  for (const entry of entries) {
    const members = (entry.schedule_entry_members ?? []) as { user_id: string }[];
    const isForeman = entry.foreman_user_id === userId;
    const isMine = members.some((m) => m.user_id === userId);
    if (!canSeeAll && !isMine && !isForeman) continue;

    const site = asSiteRef(entry.sites);
    const start = String(entry.start_time).slice(0, 5);
    const end = String(entry.end_time).slice(0, 5);
    const siteId = entry.site_id;
    const missingReport =
      includeMissingReport
      && isForeman
      && foremanLogKeys
      && !foremanLogKeys.has(`${siteId}:${userId}`);

    rows.push({
      id: entry.id,
      time: `${start}–${end}`,
      title: site?.name ?? 'Einsatz',
      place: site?.address ?? '—',
      tone: 'active',
      href: isForeman && includeMissingReport
        ? `/app/dokumentation?site=${siteId}&type=daily_report`
        : `/app/einsatzplanung?view=day&day=${dayIso}`,
      subtitle: missingReport ? 'Tagesbericht fehlt' : null,
      teamLines: teamLinesFromEntry(entry),
    });
  }

  if (!rows.length) {
    rows.push(
      ...appointments.map((a) => {
        const site = asSiteRef(a.sites);
        return {
          id: a.id,
          time: formatAppointmentTime(a.appointment_at),
          title: a.title || site?.name || 'Termin',
          place: site?.address ?? '—',
          tone: appointmentTone(a.appointment_at),
          href: `/app/baustellen/${a.site_id}`,
          teamLines: [] as ScheduleTeamLine[],
        };
      }),
    );
  }

  const assignmentSite = asSiteRef(assignment?.sites);
  if (!rows.length && assignmentSite) {
    rows.push({
      id: assignment?.site_id ?? 'assignment',
      time: '—',
      title: assignmentSite.name,
      place: assignmentSite.address ?? '—',
      tone: 'active',
      href: assignment?.site_id ? `/app/baustellen/${assignment.site_id}` : '/app/baustellen',
      teamLines: [],
    });
  }

  return rows;
}

export { formatMemberShortName, initialsFromShortName };
