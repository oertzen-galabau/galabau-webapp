'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';
import { useNavigationPendingOptional } from '@/components/app-shell/navigation-pending-context';

type AppNavLinkProps = ComponentProps<typeof Link> & {
  activePath?: string;
};

function resolveTargetHref(href: AppNavLinkProps['href']): string {
  if (typeof href === 'string') return href;
  if (href && typeof href === 'object') {
    const path = href.pathname ?? '';
    if (!href.query) return path;
    const query =
      typeof href.query === 'string'
        ? href.query
        : new URLSearchParams(
            Object.entries(href.query).flatMap(([key, value]) => {
              if (value == null) return [];
              return [[key, String(value)]];
            }),
          ).toString();
    return query ? `${path}?${query}` : path;
  }
  return '';
}

function currentLocation(pathname: string) {
  if (typeof window === 'undefined') return pathname;
  const search = window.location.search;
  return search ? `${pathname}${search}` : pathname;
}

export function AppNavLink({ href, onClick, activePath, ...rest }: AppNavLinkProps) {
  const pathname = usePathname();
  const nav = useNavigationPendingOptional();
  const targetHref = resolveTargetHref(href);

  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const active = activePath
          ? pathname === activePath || pathname.startsWith(`${activePath}/`)
          : targetHref === currentLocation(pathname);
        if (!active && nav) {
          nav.beginNavigation();
        }
      }}
    />
  );
}
