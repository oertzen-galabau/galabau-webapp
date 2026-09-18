/**
 * Hostinger Supabase-Integration (Schritt 2 im Database-Connect-Wizard).
 * Hostinger setzt SUPABASE_URL und SUPABASE_ANON_KEY automatisch.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase-Konfiguration fehlt (SUPABASE_URL / SUPABASE_ANON_KEY).',
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
