import type { Profile } from '@/lib/types/database';

export function leaderCodeForProfile(profile: Pick<Profile, 'leader_code' | 'first_name' | 'last_name'> | null): string {
  if (!profile) return '—';
  const code = profile.leader_code?.trim();
  if (code) return code.toUpperCase();
  const a = profile.first_name?.trim().charAt(0) ?? '';
  const b = profile.last_name?.trim().charAt(0) ?? '';
  const initials = `${a}${b}`.toUpperCase();
  return initials || '—';
}
