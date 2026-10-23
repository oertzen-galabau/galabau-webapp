import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';

export function formatMemberShortName(member: { first_name: string; last_name: string }): string {
  const initial = member.last_name.trim().charAt(0);
  return initial ? `${member.first_name} ${initial}.` : member.first_name;
}

export type EntryTeamMemberLine = {
  text: string;
  isForeman: boolean;
};

export type EntryTeamDisplay = {
  members: EntryTeamMemberLine[];
  external: string[];
};

function externalWorkerLines(text: string | null | undefined): string[] {
  const raw = text?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Vorarbeiter zuerst, übriges Team nach Vorname (de); Subunternehmer getrennt. */
export function sortedEntryTeamDisplay(
  entry: Pick<ScheduleEntryView, 'members' | 'foreman' | 'external_workers_text'> & {
    foreman_user_id?: string | null;
  },
): EntryTeamDisplay {
  const foremanId = entry.foreman?.id ?? entry.foreman_user_id ?? null;
  const rest = entry.members
    .filter((m) => m.user_id !== foremanId)
    .sort((a, b) => a.first_name.localeCompare(b.first_name, 'de'));

  const members: EntryTeamMemberLine[] = [];

  if (entry.foreman) {
    members.push({ text: formatMemberShortName(entry.foreman), isForeman: true });
  } else if (foremanId) {
    const fromMembers = entry.members.find((m) => m.user_id === foremanId);
    if (fromMembers) {
      members.push({ text: formatMemberShortName(fromMembers), isForeman: true });
    }
  }

  for (const member of rest) {
    members.push({ text: formatMemberShortName(member), isForeman: false });
  }

  return {
    members,
    external: externalWorkerLines(entry.external_workers_text),
  };
}

/** Flache Liste (Mitarbeiter + extern) — z. B. PDF. */
export function sortedEntryMemberLines(
  entry: Parameters<typeof sortedEntryTeamDisplay>[0],
): string[] {
  const { members, external } = sortedEntryTeamDisplay(entry);
  return [...members.map((m) => m.text), ...external];
}
