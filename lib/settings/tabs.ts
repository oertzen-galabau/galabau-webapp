import type { PermissionKey } from '@/lib/auth/permissions';

export const SETTINGS_TABS = [
  { id: 'allgemein', label: 'Allgemein', permission: 'nav.einstellungen' as PermissionKey },
  {
    id: 'stammdaten',
    label: 'Stammdaten',
    permission: 'nav.partners' as PermissionKey,
  },
  {
    id: 'berichte',
    label: 'Berichte',
    permission: 'settings.branding' as PermissionKey,
  },
  {
    id: 'startpasswort',
    label: 'Startpasswort',
    permission: 'settings.start_password' as PermissionKey,
  },
  {
    id: 'lohnregeln',
    label: 'Lohnregeln & Buchungsnummern',
    permission: 'settings.payroll_rules' as PermissionKey,
  },
  {
    id: 'zeiterfassung',
    label: 'Zeiterfassung & Pausen',
    permission: 'settings.time_tracking' as PermissionKey,
  },
  {
    id: 'bestellbudget',
    label: 'Bestellbudget',
    permission: 'orders.manage_budget' as PermissionKey,
  },
  {
    id: 'bereiche',
    label: 'Mitarbeiter-Bereiche',
    permission: 'settings.work_areas' as PermissionKey,
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export function isSettingsTab(value: string | undefined): value is SettingsTabId {
  return SETTINGS_TABS.some((t) => t.id === value);
}

export function visibleSettingsTabs(
  permissions: Set<PermissionKey>,
  isSuperadminBypass: boolean,
) {
  return SETTINGS_TABS.filter((tab) => {
    if (!('permission' in tab)) return true;
    if (isSuperadminBypass) return true;
    return permissions.has(tab.permission);
  });
}
