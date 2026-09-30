'use client';

import type { PermissionKey } from '@/lib/auth/permissions';
import type { TenantRole, TenantTheme } from '@/lib/types/database';
import { HardHat } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BriefcaseBusiness, Clock3, FileText, HardHat as HardHatIcon, LayoutDashboard,
  Menu, MessageSquare, Settings, Shield, Shirt, Users, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getUnreadMessageCount } from '@/lib/actions/employee';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/auth/logout-button';
import { RoleSwitcher } from '@/components/dev/role-switcher';
import { HeaderTimeClock } from '@/components/time-tracking/header-time-clock';
import { HeaderWeather } from '@/components/weather/header-weather';
import { displayName, initials } from '@/lib/auth/roles';
import type { Profile, TimeEntry } from '@/lib/types/database';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: PermissionKey;
};

const navItems: NavItem[] = [
  { href: '/app', label: 'Infoboard', icon: LayoutDashboard, permission: 'nav.infoboard' },
  { href: '/app/zeiten', label: 'Zeiten', icon: Clock3, permission: 'nav.zeiten' },
  { href: '/app/urlaub', label: 'Abwesenheit', icon: FileText, permission: 'nav.urlaub' },
  { href: '/app/baustellen', label: 'Baustellen', icon: BriefcaseBusiness, permission: 'nav.baustellen' },
  { href: '/app/dokumentation', label: 'Dokumentation', icon: FileText, permission: 'nav.dokumentation' },
  { href: '/app/rapporte', label: 'Rapporte', icon: FileText, permission: 'nav.rapporte' },
  { href: '/app/nachrichten', label: 'Nachrichten', icon: MessageSquare, permission: 'nav.nachrichten' },
  { href: '/app/bestellungen', label: 'Bestellungen', icon: Shirt, permission: 'nav.bestellungen' },
  { href: '/app/team', label: 'Team', icon: Users, permission: 'nav.team' },
  { href: '/app/rollen', label: 'Rollen', icon: Shield, permission: 'nav.rollen' },
  { href: '/app/einstellungen', label: 'Einstellungen', icon: Settings, permission: 'nav.einstellungen' },
];

const BOTTOM_NAV_PRIORITY = [
  '/app',
  '/app/zeiten',
  '/app/nachrichten',
  '/app/urlaub',
  '/app/bestellungen',
  '/app/dokumentation',
  '/app/baustellen',
  '/app/rapporte',
  '/app/team',
  '/app/einstellungen',
] as const;

function bottomNavItems(items: NavItem[]) {
  const byHref = new Map(items.map((item) => [item.href, item]));
  return BOTTOM_NAV_PRIORITY
    .map((href) => byHref.get(href))
    .filter((item): item is NavItem => Boolean(item))
    .slice(0, 4);
}

function NavUnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="nav-badge">{count > 99 ? '99+' : count}</span>;
}

export function TenantShell({
  theme,
  profile,
  permissions,
  isSuperadminBypass,
  tenantRoleName,
  tenantRoles,
  actualRoleId,
  devRoleOverrideId,
  showDevSwitcher = false,
  todayEntry = null,
  canRecordTime = false,
  initialUnreadCount = 0,
  children,
}: {
  theme: TenantTheme;
  profile: Profile;
  permissions: PermissionKey[];
  isSuperadminBypass: boolean;
  tenantRoleName: string | null;
  tenantRoles: TenantRole[];
  actualRoleId: string | null;
  devRoleOverrideId: string | null;
  showDevSwitcher?: boolean;
  todayEntry?: TimeEntry | null;
  canRecordTime?: boolean;
  initialUnreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [prevInitialUnreadCount, setPrevInitialUnreadCount] = useState(initialUnreadCount);
  const permSet = useMemo(() => new Set(permissions), [permissions]);
  const canViewMessages = isSuperadminBypass || permSet.has('nav.nachrichten');

  if (initialUnreadCount !== prevInitialUnreadCount) {
    setPrevInitialUnreadCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }

  useEffect(() => {
    if (!canViewMessages) return;

    const supabase = createClient();
    const refreshUnreadCount = () => {
      void getUnreadMessageCount()
        .then(setUnreadCount)
        .catch(() => undefined);
    };

    const channel = supabase
      .channel(`inbox-badge:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.id}`,
        },
        refreshUnreadCount,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.id}`,
        },
        refreshUnreadCount,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canViewMessages, profile.id]);

  const visibleNav = navItems.filter(
    (item) => isSuperadminBypass || permSet.has(item.permission),
  );
  const mobileNav = bottomNavItems(visibleNav);
  const profileActive = pathname === '/app/profil';

  const actualRoleName = tenantRoles.find((r) => r.id === actualRoleId)?.name
    ?? tenantRoleName
    ?? '—';

  return (
    <main className="design-system-app">
      <div className="app-frame">
        <aside className="app-sidebar">
          <div className="brand-lockup">
            {theme.logoUrl ? (
              <Image
                src={theme.logoUrl}
                alt=""
                width={42}
                height={42}
                unoptimized
                className="brand-logo"
              />
            ) : (
              <span className="brand-symbol">
                <HardHat size={24} />
              </span>
            )}
            <span>
              <strong>{theme.name}</strong>
              <small>Baustellenmanagement</small>
            </span>
          </div>
          <nav aria-label="Hauptnavigation">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setMobileMenu(false)}>
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {item.href === '/app/nachrichten' && <NavUnreadBadge count={unreadCount} />}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-user">
            <Link
              href="/app/profil"
              className={`sidebar-user-link${profileActive ? ' active' : ''}`}
              aria-current={profileActive ? 'page' : undefined}
            >
              <span className="avatar">{initials(profile)}</span>
              <span>
                <strong>{displayName(profile)}</strong>
                <small>{tenantRoleName ?? '—'}</small>
              </span>
            </Link>
            <LogoutButton variant="icon" />
          </div>
        </aside>

        <div className="app-main">
          <header className="app-header">
            <button type="button" className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Menü">
              <Menu size={21} />
            </button>
            <div className="mobile-brand">
              {theme.logoUrl ? (
                <Image src={theme.logoUrl} alt="" width={20} height={20} unoptimized />
              ) : (
                <HardHatIcon size={20} />
              )}
              <strong>{theme.name}</strong>
            </div>
            <div className="header-start">
              <HeaderTimeClock todayEntry={todayEntry} canRecord={canRecordTime} />
            </div>
            <div className="header-end">
              <span className="header-date">
                <small>{new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date())}</small>
                <strong>{new Intl.DateTimeFormat('de-DE').format(new Date())}</strong>
              </span>
              <HeaderWeather />
              <Link
                href="/app/profil"
                className={`avatar-button${profileActive ? ' active' : ''}`}
                aria-label="Mein Profil"
                aria-current={profileActive ? 'page' : undefined}
              >
                {initials(profile)}
              </Link>
              {showDevSwitcher && tenantRoles.length > 0 && (
                <RoleSwitcher
                  tenantRoles={tenantRoles}
                  actualRoleId={actualRoleId}
                  devRoleOverrideId={devRoleOverrideId}
                  actualRoleName={actualRoleName}
                />
              )}
            </div>
          </header>

          {mobileMenu && (
            <div className="mobile-drawer">
              <div className="mobile-drawer-head">
                <strong>Navigation</strong>
                <button type="button" onClick={() => setMobileMenu(false)}><X size={20} /></button>
              </div>
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setMobileMenu(false)}>
                    <Icon size={20} />
                    {item.label}
                    {item.href === '/app/nachrichten' && <NavUnreadBadge count={unreadCount} />}
                  </Link>
                );
              })}
              <Link
                href="/app/profil"
                className={profileActive ? 'active' : ''}
                onClick={() => setMobileMenu(false)}
              >
                <span className="avatar avatar--sm">{initials(profile)}</span>
                Mein Profil
              </Link>
              <LogoutButton variant="drawer" />
            </div>
          )}

          <div className="app-content">{children}</div>
        </div>

        <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                <Icon size={20} />
                <span>{item.label}</span>
                {item.href === '/app/nachrichten' && <NavUnreadBadge count={unreadCount} />}
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
