import type { SupabaseClient } from '@supabase/supabase-js';

/** Mandanten-Einstellung „GPS aktiv“ (Standard: aktiv). */
export async function loadTenantGpsEnabled(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('tenants')
    .select('gps_enabled')
    .eq('id', tenantId)
    .maybeSingle();
  return data?.gps_enabled !== false;
}
