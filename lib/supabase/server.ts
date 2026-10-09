import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';
import { extractSubdomain } from '@/lib/tenant/config';

async function resolveTenantSlugHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get('tenant_slug')?.value;
  if (fromCookie) return fromCookie;

  const headerList = await headers();
  const fromHeader = headerList.get('x-tenant-slug');
  if (fromHeader) return fromHeader;

  const host = headerList.get('host');
  if (host) {
    const sub = extractSubdomain(host);
    if (sub) return sub;
  }

  return undefined;
}

export async function createClient() {
  const cookieStore = await cookies();
  const tenantSlug = await resolveTenantSlugHeader();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: tenantSlug ? { 'x-tenant-slug': tenantSlug } : {},
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components können Cookies nicht setzen
        }
      },
    },
  });
}
