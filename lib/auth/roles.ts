import type { UserRole } from '@/lib/types/database';

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  verwaltung: 'Verwaltung',
  administrator: 'Administrator',
  vorarbeiter: 'Vorarbeiter',
  mitarbeiter: 'Mitarbeiter',
};

export function isSuperadmin(role: UserRole) {
  return role === 'superadmin';
}

export function canManageTenants(role: UserRole) {
  return role === 'superadmin';
}

export function displayName(profile: { first_name: string; last_name: string; email: string }) {
  const full = `${profile.first_name} ${profile.last_name}`.trim();
  return full || profile.email;
}

export function initials(profile: { first_name: string; last_name: string; email: string }) {
  const name = displayName(profile);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
