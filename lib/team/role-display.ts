import { ROLE_LABELS } from '@/lib/auth/roles';
import type { UserRole } from '@/lib/types/database';

export type TenantRoleEmbed = { name?: string | null } | null | undefined;

export function normalizeTenantRoleEmbed(
  embed: TenantRoleEmbed | TenantRoleEmbed[],
): TenantRoleEmbed {
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed ?? null;
}

/** Anzeigename der Mandanten-Rolle; Fallback auf profiles.role. */
export function profileRoleDisplayName(
  role: UserRole,
  tenantRoles: TenantRoleEmbed | TenantRoleEmbed[] | null | undefined,
): string {
  const embedded = normalizeTenantRoleEmbed(tenantRoles ?? null);
  const fromJoin = embedded?.name?.trim();
  if (fromJoin) return fromJoin;
  const fromEnum = ROLE_LABELS[role];
  if (fromEnum) return fromEnum;
  return '—';
}
