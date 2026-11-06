'use client';

import type React from 'react';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { TenantRole, TenantTheme } from '@/lib/types/database';
import { HardHat } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AppNavLink } from '@/components/app-shell/app-nav-link';
import {
  NavigationPendingProvider,
  useNavigationPending,
} from '@/components/app-shell/navigation-pending-context';
import {
  BriefcaseBusiness, CalendarRange, Clock3, FileText, FolderOpen, HardHat as HardHatIcon, LayoutDashboard,
  Menu, MessageSquare, Settings, Shield, Shirt, Users, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getPendingOrderCount } from '@/lib/actions/orders';
import { getPendingTimeApprovalCount, getUnreadMessageCount } from '@/lib/actions/employee';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/auth/logout-button';
import { FeedbackNavEntry } from '@/components/feedback/feedback-nav-entry';
import { RoleSwitcher } from '@/components/dev/role-switcher';
import { HeaderTimeClock } from '@/components/time-tracking/header-time-clock';
import { IntervalConfirmDialog } from '@/components/time-tracking/interval-confirm-dialog';
import {
  latestPauseConfirmPrompt,
  type PauseEndConfirmPrompt,
} from '@/lib/time-tracking/pause-confirm-prompt';
import { HeaderWeather } from '@/components/weather/header-weather';
import { displayName, initials } from '@/lib/auth/roles';
import type { Profile, TimeEntry, TimeEntryInterval } from '@/lib/types/database';
import type { TodayScheduleContext } from '@/lib/time-tracking/today-schedule-context';

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
  { href: '/app/einsatzplanung', label: 'Einsatzplan', icon: CalendarRange, permission: 'nav.einsatzplanung' },
  { href: '/app/dokumentation', label: 'Dokumentation', icon: FileText, permission: 'nav.dokumentation' },
  { href: '/app/dokumente', label: 'Dokumente', icon: FolderOpen, permission: 'nav.rapporte' },
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
  '/app/einsatzplanung',
  '/app/dokumente',
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

function isNavItemActive(pathname: string, href: string) {
  if (href === '/app/nachrichten') {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`));
}

const NACHRICHTEN_THREAD_PATH = /^\/app\/nachrichten\/[^/]+$/;

function TenantShellInner({
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
  todayIntervals = [],
  todayScheduleContext = null,
  canRecordTime = false,
  initialUnreadCount = 0,
  initialPendingOrderCount = 0,
  initialPendingTimeApprovalCount = 0,
  tenantId,
  showDokumentationAsForeman = false,
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
  todayIntervals?: TimeEntryInterval[];
  todayScheduleContext?: TodayScheduleContext | null;
  canRecordTime?: boolean;
  initialUnreadCount?: number;
  initialPendingOrderCount?: number;
  initialPendingTimeApprovalCount?: number;
  tenantId: string;
  showDokumentationAsForeman?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigationPending = useNavigationPending();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [pauseConfirmPrompt, setPauseConfirmPrompt] = useState<PauseEndConfirmPrompt | null>(null);
  const [pauseConfirmLoading, setPauseConfirmLoading] = useState(false);
  const [awaitPauseConfirmAfterRefresh, setAwaitPauseConfirmAfterRefresh] = useState(false);

  useEffect(() => {
    if (!awaitPauseConfirmAfterRefresh || pauseConfirmOpen) return;
    const fallback = latestPauseConfirmPrompt(todayIntervals);
    if (fallback) {
      setPauseConfirmPrompt(fallback);
      setPauseConfirmOpen(true);
      setAwaitPauseConfirmAfterRefresh(false);
    }
  }, [awaitPauseConfirmAfterRefresh, pauseConfirmOpen, todayIntervals]);

  function openPauseConfirmLoading() {
    setPauseConfirmPrompt(null);
    setPauseConfirmLoading(true);
    setPauseConfirmOpen(true);
    setAwaitPauseConfirmAfterRefresh(false);
  }

  function openPauseConfirmDialog(prompt: PauseEndConfirmPrompt) {
    setPauseConfirmPrompt(prompt);
    setPauseConfirmLoading(false);
    setPauseConfirmOpen(true);
    setAwaitPauseConfirmAfterRefresh(false);
  }

  function closePauseConfirmDialog() {
    setPauseConfirmOpen(false);
    setPauseConfirmPrompt(null);
    setPauseConfirmLoading(false);
  }
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [prevInitialUnreadCount, setPrevInitialUnreadCount] = useState(initialUnreadCount);
  const [pendingOrderCount, setPendingOrderCount] = useState(initialPendingOrderCount);
  const [prevInitialPendingOrderCount, setPrevInitialPendingOrderCount] = useState(initialPendingOrderCount);
  const [pendingTimeApprovalCount, setPendingTimeApprovalCount] = useState(initialPendingTimeApprovalCount);
  const [prevInitialPendingTimeApprovalCount, setPrevInitialPendingTimeApprovalCount] = useState(
    initialPendingTimeApprovalCount,
  );
  const permSet = useMemo(() => new Set(permissions), [permissions]);
  const canViewMessages = isSuperadminBypass || permSet.has('nav.nachrichten');
  const canSeeOrderBadge =
    (isSuperadminBypass || permSet.has('nav.bestellungen')) &&
    (isSuperadminBypass || permSet.has('orders.manage'));
  const canSeeTimeApprovalBadge =
    (isSuperadminBypass || permSet.has('nav.zeiten')) &&
    (isSuperadminBypass || permSet.has('zeiten.approve'));

  const navBadgeCount = (href: string) => {
    if (href === '/app/nachrichten') return unreadCount;
    if (href === '/app/bestellungen') return pendingOrderCount;
    if (href === '/app/zeiten') return pendingTimeApprovalCount;
    return 0;
  };

  if (initialUnreadCount !== prevInitialUnreadCount) {
    setPrevInitialUnreadCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }
  if (initialPendingOrderCount !== prevInitialPendingOrderCount) {
    setPrevInitialPendingOrderCount(initialPendingOrderCount);
    setPendingOrderCount(initialPendingOrderCount);
  }
  if (initialPendingTimeApprovalCount !== prevInitialPendingTimeApprovalCount) {
    setPrevInitialPendingTimeApprovalCount(initialPendingTimeApprovalCount);
    setPendingTimeApprovalCount(initialPendingTimeApprovalCount);
  }
  useEffect(() => {
    if (!canViewMessages) return;

    const supabase = createClient();
    const refreshInbox = () => {
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
        refreshInbox,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.id}`,
        },
        refreshInbox,
      )
      // Nach (Wieder-)Verbindung sofort nachladen, falls Events verpasst wurden.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refreshInbox();
      });

    // Fallback, falls Realtime nicht zustellt (Netzwerk, Proxy, Tab im Hintergrund).
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshInbox();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshInbox);
    const interval = window.setInterval(onVisible, 30_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshInbox);
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [canViewMessages, profile.id]);

  // Zähler bei jedem Seitenwechsel aktualisieren (Layout wird bei Soft-Navigation nicht neu geladen).
  useEffect(() => {
    if (!canViewMessages) return;
    void getUnreadMessageCount()
      .then(setUnreadCount)
      .catch(() => undefined);
  }, [canViewMessages, pathname]);

  useEffect(() => {
    if (!canSeeOrderBadge) return;

    const supabase = createClient();
    const refreshOrders = () => {
      void getPendingOrderCount()
        .then(setPendingOrderCount)
        .catch(() => undefined);
    };

    refreshOrders();

    const channel = supabase
      .channel(`orders-badge:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_orders' }, refreshOrders)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canSeeOrderBadge, profile.id, pathname]);

  useEffect(() => {
    if (!canSeeTimeApprovalBadge) return;

    const supabase = createClient();
    const refreshTimeApprovals = () => {
      void getPendingTimeApprovalCount()
        .then(setPendingTimeApprovalCount)
        .catch(() => undefined);
    };

    refreshTimeApprovals();

    const channel = supabase
      .channel(`time-approval-badge:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        refreshTimeApprovals,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refreshTimeApprovals();
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshTimeApprovals();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshTimeApprovals);
    const interval = window.setInterval(onVisible, 30_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshTimeApprovals);
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [canSeeTimeApprovalBadge, profile.id, tenantId, pathname]);

  useEffect(() => {
    if (!canSeeTimeApprovalBadge) return;
    void getPendingTimeApprovalCount()
      .then(setPendingTimeApprovalCount)
      .catch(() => undefined);
  }, [canSeeTimeApprovalBadge, pathname]);

  const visibleNav = navItems.filter((item) => {
    if (isSuperadminBypass || permSet.has(item.permission)) return true;
    return item.href === '/app/dokumentation' && showDokumentationAsForeman;
  });
  const mobileNav = bottomNavItems(visibleNav);
  const profileActive = pathname === '/app/profil';

  const actualRoleName = tenantRoles.find((r) => r.id === actualRoleId)?.name
    ?? tenantRoleName
    ?? '—';

  const isNachrichtenList = pathname === '/app/nachrichten';
  const isNachrichtenThread = NACHRICHTEN_THREAD_PATH.test(pathname);
  const appMainClass = [
    'app-main',
    isNachrichtenList ? 'app-main--nachrichten-list' : '',
    isNachrichtenThread ? 'app-main--nachrichten-thread' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const appFrameClass = [
    'app-frame',
    isNachrichtenThread ? 'app-frame--nachrichten-thread' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const appContentClass = [
    'app-content',
    navigationPending.isBusy ? 'app-content--navigating' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className="design-system-app">
      <div className={appFrameClass}>
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
                <AppNavLink key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setMobileMenu(false)}>
                  <Icon size={19} />
                  <span>{item.label}</span>
                  <NavUnreadBadge count={navBadgeCount(item.href)} />
                </AppNavLink>
              );
            })}
            <FeedbackNavEntry />
          </nav>
          <div className="sidebar-user">
            <AppNavLink
              href="/app/profil"
              className={`sidebar-user-link${profileActive ? ' active' : ''}`}
              aria-current={profileActive ? 'page' : undefined}
            >
              <span className="avatar">{initials(profile)}</span>
              <span>
                <strong>{displayName(profile)}</strong>
                <small>{tenantRoleName ?? '—'}</small>
              </span>
            </AppNavLink>
            <LogoutButton variant="icon" />
          </div>
        </aside>

        <div className={appMainClass}>
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
              <HeaderTimeClock
                todayEntry={todayEntry}
                todayIntervals={todayIntervals}
                todayScheduleContext={todayScheduleContext}
                canRecord={canRecordTime}
                onPauseConfirm={openPauseConfirmDialog}
                onPauseConfirmLoading={openPauseConfirmLoading}
                onPauseConfirmDismiss={closePauseConfirmDialog}
                onAfterPauseEnd={() => setAwaitPauseConfirmAfterRefresh(true)}
              />
            </div>
            <div className="header-end">
              <span className="header-date">
                <small>{new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date())}</small>
                <strong>{new Intl.DateTimeFormat('de-DE').format(new Date())}</strong>
              </span>
              <HeaderWeather />
              <AppNavLink
                href="/app/profil"
                className={`avatar-button${profileActive ? ' active' : ''}`}
                aria-label="Mein Profil"
                aria-current={profileActive ? 'page' : undefined}
              >
                {initials(profile)}
              </AppNavLink>
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
                  <AppNavLink key={item.href} href={item.href} className={active ? 'active' : ''} onClick={() => setMobileMenu(false)}>
                    <Icon size={20} />
                    {item.label}
                    <NavUnreadBadge count={navBadgeCount(item.href)} />
                  </AppNavLink>
                );
              })}
              <FeedbackNavEntry className="mobile-drawer-feedback" onNavigate={() => setMobileMenu(false)} />
              <AppNavLink
                href="/app/profil"
                className={profileActive ? 'active' : ''}
                onClick={() => setMobileMenu(false)}
              >
                <span className="avatar avatar--sm">{initials(profile)}</span>
                Mein Profil
              </AppNavLink>
              <LogoutButton variant="drawer" />
            </div>
          )}

          <div className={appContentClass}>{children}</div>
        </div>

        <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item.href);
            return (
              <AppNavLink key={item.href} href={item.href} className={active ? 'active' : ''}>
                <Icon size={20} />
                <span>{item.label}</span>
                <NavUnreadBadge count={navBadgeCount(item.href)} />
              </AppNavLink>
            );
          })}
        </nav>
      </div>

      <IntervalConfirmDialog
        open={pauseConfirmOpen}
        prompt={pauseConfirmPrompt}
        loading={pauseConfirmLoading}
        onClose={closePauseConfirmDialog}
      />
    </main>
  );
}

export function TenantShell(props: React.ComponentProps<typeof TenantShellInner>) {
  return (
    <NavigationPendingProvider>
      <TenantShellInner {...props} />
    </NavigationPendingProvider>
  );
}
