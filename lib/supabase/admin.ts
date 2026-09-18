import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/lib/supabase/env';

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt für Admin-Operationen.');
  }

  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
