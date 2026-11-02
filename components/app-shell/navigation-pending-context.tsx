'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

type NavigationPendingContextValue = {
  isNavigating: boolean;
  isRefreshing: boolean;
  isBusy: boolean;
  beginNavigation: () => void;
  navigate: (href: string) => void;
  refresh: () => void;
};

const NavigationPendingContext = createContext<NavigationPendingContextValue | null>(null);

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isNavTransitionPending, startNavTransition] = useTransition();
  const [isRefreshPending, startRefreshTransition] = useTransition();

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  useEffect(() => {
    if (!isNavTransitionPending && !isRefreshPending) {
      setIsNavigating(false);
    }
  }, [isNavTransitionPending, isRefreshPending]);

  const beginNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setIsNavigating(true);
      startNavTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const refresh = useCallback(() => {
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router]);

  const value = useMemo(
    () => ({
      isNavigating,
      isRefreshing: isRefreshPending,
      isBusy: isNavigating || isNavTransitionPending || isRefreshPending,
      beginNavigation,
      navigate,
      refresh,
    }),
    [isNavigating, isNavTransitionPending, isRefreshPending, beginNavigation, navigate, refresh],
  );

  return (
    <NavigationPendingContext.Provider value={value}>{children}</NavigationPendingContext.Provider>
  );
}

export function useNavigationPendingOptional() {
  return useContext(NavigationPendingContext);
}

/** Navigation + refresh with loading state; works even if Provider fehlt (Fallback via Router). */
export function useAppNavigation() {
  const ctx = useNavigationPendingOptional();
  const router = useRouter();
  const pathname = usePathname();
  const [localNavigating, setLocalNavigating] = useState(false);
  const [navPending, startNavTransition] = useTransition();
  const [refreshPending, startRefreshTransition] = useTransition();

  useEffect(() => {
    if (ctx) return;
    setLocalNavigating(false);
  }, [ctx, pathname]);

  useEffect(() => {
    if (ctx) return;
    if (!navPending && !refreshPending) {
      setLocalNavigating(false);
    }
  }, [ctx, navPending, refreshPending]);

  const beginNavigation = useCallback(() => {
    if (ctx) {
      ctx.beginNavigation();
      return;
    }
    setLocalNavigating(true);
  }, [ctx]);

  const navigate = useCallback(
    (href: string) => {
      if (ctx) {
        ctx.navigate(href);
        return;
      }
      setLocalNavigating(true);
      startNavTransition(() => {
        router.push(href);
      });
    },
    [ctx, router],
  );

  const refresh = useCallback(() => {
    if (ctx) {
      ctx.refresh();
      return;
    }
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [ctx, router]);

  if (ctx) {
    return ctx;
  }

  return {
    isNavigating: localNavigating,
    isRefreshing: refreshPending,
    isBusy: localNavigating || navPending || refreshPending,
    beginNavigation,
    navigate,
    refresh,
  };
}

export function useNavigationPending() {
  return useAppNavigation();
}
