import type { PermissionKey } from '@/lib/auth/permissions';
import type { EmployeeDetailMode } from '@/lib/team/employee-detail-data';

export type EmployeeTabId =
  | 'overview'
  | 'stammdaten'
  | 'rolle'
  | 'urlaub'
  | 'zeiten'
  | 'einsatz'
  | 'bestellungen'
  | 'notizen'
  | 'sicherheit';

type EmployeeTabDef = {
  id: EmployeeTabId;
  label: string;
  modes: readonly EmployeeDetailMode[];
  /** Self-Modus: leeres Array = immer sichtbar (für eingeloggten Mandanten-Mitglied) */
  permissionSelf?: readonly PermissionKey[];
  permissionAdmin?: PermissionKey;
};

export const EMPLOYEE_TABS: readonly EmployeeTabDef[] = [
  {
    id: 'overview',
    label: 'Übersicht',
    modes: ['self', 'admin'],
    permissionSelf: [],
    permissionAdmin: 'team.view',
  },
  {
    id: 'stammdaten',
    label: 'Stammdaten',
    modes: ['self', 'admin'],
    permissionSelf: [],
    permissionAdmin: 'team.view',
  },
  {
    id: 'rolle',
    label: 'Rolle & Zugriff',
    modes: ['admin'],
    permissionAdmin: 'team.view',
  },
  {
    id: 'urlaub',
    label: 'Urlaub',
    modes: ['self', 'admin'],
    permissionSelf: [],
    permissionAdmin: 'team.view',
  },
  {
    id: 'zeiten',
    label: 'Zeiten',
    modes: ['self', 'admin'],
    permissionSelf: [],
    permissionAdmin: 'team.view',
  },
  {
    id: 'einsatz',
    label: 'Einsatz',
    modes: ['admin'],
    permissionAdmin: 'team.view',
  },
  {
    id: 'bestellungen',
    label: 'Bestellungen',
    modes: ['self', 'admin'],
    permissionSelf: [],
    permissionAdmin: 'team.view',
  },
  {
    id: 'notizen',
    label: 'Notizen',
    modes: ['admin'],
    permissionAdmin: 'team.notes',
  },
  {
    id: 'sicherheit',
    label: 'Sicherheit',
    modes: ['self'],
    /** E-Mail/Passwort-Formulare prüfen Rechte intern; Abmeldung für alle sichtbar */
    permissionSelf: [],
  },
];

function hasAnyPermission(permissions: Set<PermissionKey>, keys: readonly PermissionKey[]) {
  if (keys.length === 0) return true;
  return keys.some((k) => permissions.has(k));
}

export function isEmployeeTab(value: string | undefined): value is EmployeeTabId {
  return EMPLOYEE_TABS.some((t) => t.id === value);
}

export function visibleEmployeeTabs(
  mode: EmployeeDetailMode,
  permissions: Set<PermissionKey>,
  isSuperadminBypass: boolean,
) {
  return EMPLOYEE_TABS.filter((tab) => {
    if (!tab.modes.includes(mode)) return false;
    if (isSuperadminBypass) return true;
    if (mode === 'self') {
      const keys = tab.permissionSelf;
      if (!keys) return false;
      return hasAnyPermission(permissions, keys);
    }
    const key = tab.permissionAdmin;
    if (!key) return false;
    return permissions.has(key);
  });
}
