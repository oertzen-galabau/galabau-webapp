import type { SupabaseClient } from '@supabase/supabase-js';

export function storagePathBelongsToTenant(tenantId: string, path: string): boolean {
  const first = path.split('/')[0];
  return first === tenantId;
}

export function assertStoragePathBelongsToTenant(tenantId: string, path: string): void {
  if (!storagePathBelongsToTenant(tenantId, path)) {
    throw new Error('Keine Berechtigung für diese Datei');
  }
}

export async function assertDailyLogInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  dailyLogId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('id', dailyLogId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) throw new Error('Tageseintrag nicht gefunden');
}

export async function assertReportInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  reportId: string,
): Promise<{ id: string; pdf_url: string | null; daily_log_id: string }> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, pdf_url, daily_log_id')
    .eq('id', reportId)
    .eq('tenant_id', tenantId)
    .single();
  if (error || !data) throw new Error('Rapport nicht gefunden');
  return data;
}

export async function assertSiteInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  siteId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) throw new Error('Baustelle nicht gefunden');
}

export async function assertProfileInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) throw new Error('Mitarbeiter nicht gefunden');
}

export async function assertPartnerInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  partnerId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('tenant_business_partners')
    .select('id')
    .eq('id', partnerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) throw new Error('Geschäftspartner nicht gefunden');
}
