/**
 * Liest INVITE_TOKEN_PEPPER und PASSWORD_RESET_PEPPER aus .env.local und
 * wendet sie per Hostinger-API an (voller Env-Replace — nur ausführen, wenn
 * die Liste der bestehenden Variablen zuvor gesichert wurde).
 *
 * Voraussetzung: Hostinger MCP oder hPanel manuell (empfohlen bei API-Timeout).
 *
 * Manuell: hPanel → Websites → Node.js → Environment variables → Keys ergänzen,
 * App neu starten. Werte aus Personal Store: galabau-hostinger-pepper.env
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

const local = parseEnv(readFileSync(envPath, 'utf8'));
const invite = local.INVITE_TOKEN_PEPPER?.trim();
const reset = local.PASSWORD_RESET_PEPPER?.trim();

if (!invite && !reset) {
  console.error('In .env.local fehlen INVITE_TOKEN_PEPPER und PASSWORD_RESET_PEPPER.');
  process.exit(1);
}

console.log('Zu setzen auf Hostinger (bestehende Variablen beibehalten, nur ergänzen):');
if (invite) console.log(`  INVITE_TOKEN_PEPPER (${invite.length} Zeichen)`);
if (reset) console.log(`  PASSWORD_RESET_PEPPER (${reset.length} Zeichen)`);
console.log('\nDanach: Node.js-App neu starten (Restart reicht für Server-Env).');
