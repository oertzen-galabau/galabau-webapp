export const PERMISSION_KEYS = [
  'nav.infoboard',
  'nav.zeiten',
  'nav.urlaub',
  'nav.baustellen',
  'nav.dokumentation',
  'nav.rapporte',
  'nav.nachrichten',
  'nav.bestellungen',
  'nav.partners',
  'nav.team',
  'nav.einstellungen',
  'nav.rollen',
  'infoboard.assignments',
  'infoboard.posts',
  'infoboard.customize',
  'zeiten.record',
  'zeiten.approve',
  'zeiten.view_all',
  'zeiten.bookings.edit',
  'zeiten.bad_weather.mark',
  'urlaub.request',
  'urlaub.approve',
  'urlaub.view_all',
  'sites.view',
  'sites.manage',
  'sites.assign_team',
  'documentation.manage',
  'documentation.dictate',
  'reports.generate',
  'reports.send',
  'messages.send',
  'orders.create',
  'orders.manage_catalog',
  'orders.manage',
  'orders.manage_budget',
  'partners.view',
  'partners.manage',
  'team.view',
  'team.invite',
  'team.assign_role',
  'team.leave_entitlement',
  'team.edit_profile',
  'team.deactivate',
  'team.notes',
  'team.password_reset',
  'team.manage_invites',
  'team.delete',
  'settings.branding',
  'settings.holidays',
  'settings.payroll_rules',
  'settings.time_tracking',
  'settings.start_password',
  'roles.manage',
  'profile.edit_self',
  'profile.change_email',
  'profile.change_password',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionDef = {
  key: PermissionKey;
  label: string;
  group: string;
  implies?: PermissionKey[];
};

export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: 'nav.infoboard', label: 'Infoboard', group: 'Navigation' },
  { key: 'nav.zeiten', label: 'Zeiten', group: 'Navigation' },
  { key: 'nav.urlaub', label: 'Urlaub', group: 'Navigation' },
  { key: 'nav.baustellen', label: 'Baustellen', group: 'Navigation' },
  { key: 'nav.dokumentation', label: 'Dokumentation', group: 'Navigation' },
  { key: 'nav.rapporte', label: 'Rapporte', group: 'Navigation' },
  { key: 'nav.nachrichten', label: 'Nachrichten', group: 'Navigation' },
  { key: 'nav.bestellungen', label: 'Bestellungen', group: 'Navigation' },
  { key: 'nav.partners', label: 'Subunternehmer & Lieferanten', group: 'Navigation' },
  { key: 'nav.team', label: 'Team', group: 'Navigation' },
  { key: 'nav.einstellungen', label: 'Einstellungen', group: 'Navigation' },
  { key: 'nav.rollen', label: 'Rollen & Berechtigungen', group: 'Navigation' },
  { key: 'infoboard.assignments', label: 'Einteilungen planen', group: 'Infoboard' },
  { key: 'infoboard.posts', label: 'Beiträge veröffentlichen', group: 'Infoboard' },
  { key: 'infoboard.customize', label: 'Infoboard anpassen', group: 'Infoboard', implies: ['nav.infoboard'] },
  { key: 'zeiten.record', label: 'Zeiten erfassen', group: 'Zeiten' },
  { key: 'zeiten.approve', label: 'Zeiten freigeben', group: 'Zeiten', implies: ['zeiten.view_all'] },
  { key: 'zeiten.view_all', label: 'Alle Zeiteinträge einsehen', group: 'Zeiten' },
  { key: 'zeiten.bookings.edit', label: 'Buchungszeilen bearbeiten', group: 'Zeiten', implies: ['zeiten.view_all'] },
  { key: 'zeiten.bad_weather.mark', label: 'Schlechtwetter markieren', group: 'Zeiten' },
  { key: 'urlaub.request', label: 'Urlaub beantragen', group: 'Urlaub' },
  { key: 'urlaub.approve', label: 'Urlaub genehmigen', group: 'Urlaub', implies: ['urlaub.view_all'] },
  { key: 'urlaub.view_all', label: 'Alle Anträge einsehen', group: 'Urlaub' },
  {
    key: 'sites.view',
    label: 'Baustellen einsehen (Navigation)',
    group: 'Baustellen',
  },
  { key: 'sites.manage', label: 'Baustellen bearbeiten', group: 'Baustellen', implies: ['sites.view'] },
  { key: 'sites.assign_team', label: 'Baustellen-Team zuweisen', group: 'Baustellen', implies: ['sites.view'] },
  { key: 'documentation.manage', label: 'Tagesdokumentation', group: 'Dokumentation', implies: ['sites.view'] },
  { key: 'documentation.dictate', label: 'Diktierfunktion', group: 'Dokumentation', implies: ['documentation.manage'] },
  { key: 'reports.generate', label: 'Rapporte erstellen', group: 'Rapporte', implies: ['sites.view'] },
  { key: 'reports.send', label: 'Rapporte versenden', group: 'Rapporte', implies: ['reports.generate'] },
  { key: 'messages.send', label: 'Nachrichten senden', group: 'Nachrichten' },
  { key: 'orders.create', label: 'Bestellungen aufgeben', group: 'Bestellungen' },
  {
    key: 'orders.manage_catalog',
    label: 'Bestellkatalog verwalten',
    group: 'Bestellungen',
    implies: ['nav.bestellungen'],
  },
  {
    key: 'orders.manage',
    label: 'Bestellungen verwalten',
    group: 'Bestellungen',
    implies: ['nav.bestellungen'],
  },
  {
    key: 'orders.manage_budget',
    label: 'Bestellbudget verwalten',
    group: 'Bestellungen',
    implies: ['nav.bestellungen'],
  },
  {
    key: 'partners.view',
    label: 'Subunternehmer & Lieferanten einsehen',
    group: 'Geschäftspartner',
    implies: ['nav.partners'],
  },
  {
    key: 'partners.manage',
    label: 'Subunternehmer & Lieferanten verwalten',
    group: 'Geschäftspartner',
    implies: ['partners.view'],
  },
  { key: 'team.view', label: 'Team einsehen', group: 'Team', implies: ['nav.team'] },
  { key: 'team.invite', label: 'Mitarbeiter anlegen', group: 'Team', implies: ['team.view'] },
  { key: 'team.assign_role', label: 'Rollen zuweisen', group: 'Team', implies: ['team.view'] },
  { key: 'team.leave_entitlement', label: 'Urlaubsanspruch pflegen', group: 'Team', implies: ['team.view'] },
  { key: 'team.edit_profile', label: 'Stammdaten bearbeiten', group: 'Team', implies: ['team.view'] },
  { key: 'team.deactivate', label: 'Mitarbeiter aktivieren/deaktivieren', group: 'Team', implies: ['team.view'] },
  { key: 'team.notes', label: 'Personalnotizen pflegen', group: 'Team', implies: ['team.view'] },
  { key: 'team.password_reset', label: 'Passwort-Reset senden', group: 'Team', implies: ['team.view'] },
  { key: 'team.manage_invites', label: 'Einladungen verwalten', group: 'Team', implies: ['team.view'] },
  { key: 'team.delete', label: 'Mitarbeiter löschen', group: 'Team', implies: ['team.view'] },
  { key: 'settings.branding', label: 'Branding anpassen', group: 'Einstellungen', implies: ['nav.einstellungen'] },
  { key: 'settings.holidays', label: 'Feiertage & Betriebsurlaub', group: 'Einstellungen', implies: ['nav.einstellungen'] },
  { key: 'settings.payroll_rules', label: 'Lohnregeln & Buchungsnummern', group: 'Einstellungen', implies: ['nav.einstellungen'] },
  { key: 'settings.time_tracking', label: 'Zeiterfassung & Pausen', group: 'Einstellungen', implies: ['nav.einstellungen'] },
  { key: 'settings.start_password', label: 'Startpasswort verwalten', group: 'Einstellungen', implies: ['nav.einstellungen'] },
  { key: 'roles.manage', label: 'Rollen & Matrix verwalten', group: 'Rollen', implies: ['nav.rollen'] },
  { key: 'profile.edit_self', label: 'Eigenes Profil bearbeiten', group: 'Profil' },
  { key: 'profile.change_email', label: 'Eigene E-Mail ändern', group: 'Profil' },
  { key: 'profile.change_password', label: 'Eigenes Passwort ändern', group: 'Profil' },
];

export const SYSTEM_ROLE_SLUGS = ['verwaltung', 'administrator', 'vorarbeiter', 'mitarbeiter'] as const;
export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[number];

export const SYSTEM_ROLE_LABELS: Record<SystemRoleSlug, string> = {
  verwaltung: 'Verwaltung',
  administrator: 'Administrator',
  vorarbeiter: 'Vorarbeiter',
  mitarbeiter: 'Mitarbeiter',
};

const BASE_EMPLOYEE: PermissionKey[] = [
  'nav.infoboard', 'nav.zeiten', 'nav.urlaub', 'nav.nachrichten', 'nav.bestellungen',
  'infoboard.customize',
  'zeiten.record', 'urlaub.request', 'messages.send', 'orders.create',
  'profile.edit_self', 'profile.change_email', 'profile.change_password',
];

const FOREMAN_EXTRA: PermissionKey[] = [
  'nav.baustellen', 'nav.dokumentation', 'nav.rapporte', 'nav.partners', 'partners.view',
  'infoboard.assignments', 'sites.view', 'sites.manage', 'documentation.manage', 'documentation.dictate',
  'reports.generate', 'reports.send',
  'zeiten.view_all', 'zeiten.approve', 'zeiten.bookings.edit', 'zeiten.bad_weather.mark',
];

const ADMIN_EXTRA: PermissionKey[] = [
  'sites.assign_team',
  'nav.team', 'nav.einstellungen', 'nav.rollen',
  'infoboard.posts', 'urlaub.approve', 'urlaub.view_all',
  'team.view', 'team.invite', 'team.assign_role', 'team.leave_entitlement',
  'team.edit_profile', 'team.deactivate', 'team.notes', 'team.password_reset', 'team.manage_invites', 'team.delete',
  'settings.branding', 'settings.holidays', 'settings.payroll_rules', 'settings.time_tracking', 'settings.start_password', 'roles.manage',
  'orders.manage_catalog',
  'orders.manage',
  'orders.manage_budget',
  'partners.manage',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleSlug, PermissionKey[]> = {
  mitarbeiter: [...BASE_EMPLOYEE],
  vorarbeiter: [...BASE_EMPLOYEE, ...FOREMAN_EXTRA],
  verwaltung: [...BASE_EMPLOYEE, ...FOREMAN_EXTRA, ...ADMIN_EXTRA],
  administrator: [...BASE_EMPLOYEE, ...FOREMAN_EXTRA, ...ADMIN_EXTRA],
};

export function expandPermissions(keys: PermissionKey[]): Set<PermissionKey> {
  const result = new Set<PermissionKey>();
  const catalog = new Map(PERMISSION_CATALOG.map((p) => [p.key, p]));

  function add(key: PermissionKey) {
    if (result.has(key)) return;
    result.add(key);
    const def = catalog.get(key);
    def?.implies?.forEach(add);
  }

  keys.forEach(add);
  return result;
}

export function allPermissionKeys(): Set<PermissionKey> {
  return expandPermissions([...PERMISSION_KEYS]);
}

export function hasPermissionKey(
  permissions: Set<PermissionKey>,
  key: PermissionKey,
  isSuperadminBypass: boolean,
): boolean {
  if (isSuperadminBypass) return true;
  return permissions.has(key);
}

export function permissionGroups(): { group: string; items: PermissionDef[] }[] {
  const groups = new Map<string, PermissionDef[]>();
  for (const item of PERMISSION_CATALOG) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}
