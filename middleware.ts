import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { extractSubdomain } from '@/lib/tenant/config';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/passwort-setzen', '/anfrage', '/api/tenant-request', '/api/auth/callback', '/showcase'];
const SUPERADMIN_PREFIX = '/superadmin';

/** Öffentliche Routen, die auf Mandanten-Subdomains nicht nach /app/* umgeschrieben werden. */
const TENANT_REWRITE_SKIP = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/passwort-setzen',
  '/einladung',
  '/anfrage',
  '/showcase',
  SUPERADMIN_PREFIX,
];

function isInvitationPath(pathname: string) {
  return pathname === '/einladung' || pathname.startsWith('/einladung/');
}

function shouldSkipTenantRewrite(pathname: string) {
  return TENANT_REWRITE_SKIP.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const subdomain = extractSubdomain(host);
  const tenantSlug = subdomain ?? request.cookies.get('tenant_slug')?.value ?? null;

  const response = await updateSession(request);

  if (tenantSlug) {
    response.headers.set('x-tenant-slug', tenantSlug);
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || isInvitationPath(pathname);
  const isApi = pathname.startsWith('/api/');
  const isShowcase = pathname.startsWith('/showcase');
  const isSuperadminRoute = pathname.startsWith(SUPERADMIN_PREFIX);

  if (isShowcase) return response;

  if (tenantSlug && !isApi && !pathname.startsWith('/app') && !shouldSkipTenantRewrite(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/app${pathname === '/' ? '' : pathname}`;
    const rewriteResponse = NextResponse.rewrite(url, { request, headers: response.headers });
    response.cookies.getAll().forEach(({ name, value }) => {
      rewriteResponse.cookies.set(name, value);
    });
    return rewriteResponse;
  }

  if (!tenantSlug && pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!isPublic && !isApi && pathname !== '/login') {
    const hasSession = request.cookies.getAll().some((c) => c.name.includes('auth-token') || c.name.startsWith('sb-'));
    if (!hasSession && !pathname.startsWith('/api/')) {
      if (isSuperadminRoute || tenantSlug) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
