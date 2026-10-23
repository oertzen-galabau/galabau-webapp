import type { Profile } from '@/lib/types/database';

/** Kürzel für Einsatzplan/PDF: erste Buchstaben von Vor- und Nachname. */
export function computeLeaderCode(firstName: string, lastName: string): string | null {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  const initials = `${a}${b}`.toUpperCase();
  return initials || null;
}

export function leaderCodeForProfile(
  profile: Pick<Profile, 'leader_code' | 'first_name' | 'last_name'> | null,
): string {
  if (!profile) return '—';
  const fromName = computeLeaderCode(profile.first_name, profile.last_name);
  if (fromName) return fromName;
  const stored = profile.leader_code?.trim();
  if (stored) return stored.toUpperCase();
  return '—';
}
