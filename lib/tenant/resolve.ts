import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
  DEFAULT_SIDEBAR_COLOR,
  DEFAULT_SIDEBAR_TEXT_COLOR,
  DEFAULT_SURFACE_COLOR,
} from '@/lib/tenant/config';
import type { Tenant } from '@/lib/types/database';

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('tenants').select('*').eq('slug', slug).maybeSingle();
  if (error || !data) return null;
  return data as Tenant;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('tenants').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as Tenant;
}

export function tenantThemeStyle(
  tenant: Pick<
    Tenant,
    'brand_color' | 'accent_color' | 'sidebar_color' | 'sidebar_text_color' | 'surface_color'
  >,
) {
  return {
    '--brand': tenant.brand_color || DEFAULT_BRAND_COLOR,
    '--accent': tenant.accent_color || DEFAULT_ACCENT_COLOR,
    '--sidebar': tenant.sidebar_color || DEFAULT_SIDEBAR_COLOR,
    '--sidebar-text': tenant.sidebar_text_color || DEFAULT_SIDEBAR_TEXT_COLOR,
    '--surface': tenant.surface_color || DEFAULT_SURFACE_COLOR,
  } as React.CSSProperties;
}
