/**
 * Hostinger setzt SUPABASE_URL / SUPABASE_ANON_KEY.
 * Next.js braucht NEXT_PUBLIC_* zur Build-Zeit — hier synchronisieren.
 */
import { spawnSync } from 'node:child_process';

const env = { ...process.env };

if (env.SUPABASE_URL && !env.NEXT_PUBLIC_SUPABASE_URL) {
  env.NEXT_PUBLIC_SUPABASE_URL = env.SUPABASE_URL;
}

if (env.SUPABASE_ANON_KEY && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[build] WARNUNG: SUPABASE_SERVICE_ROLE_KEY fehlt — Registrierung und Admin-Aktionen funktionieren in Produktion nicht. Auf Hostinger manuell setzen.',
  );
}

const result = spawnSync('next', ['build'], {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 1);
