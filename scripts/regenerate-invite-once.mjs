/**
 * One-off: regenerate employee invitation (not committed with secrets).
 * Usage:
 *   PASSWORD_RESET_PEPPER='…' NEXT_PUBLIC_ROOT_DOMAIN='mistyrose-termite-491255.hostingersite.com' \
 *     node scripts/regenerate-invite-once.mjs <profileId> [actorProfileId]
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomInt } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const text = readFileSync(join(root, '.env.local'), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i);
    const val = t.slice(i + 1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const TEMP_PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getPepper() {
  const pepper = process.env.INVITE_TOKEN_PEPPER ?? process.env.PASSWORD_RESET_PEPPER;
  if (!pepper) {
    console.error('PASSWORD_RESET_PEPPER oder INVITE_TOKEN_PEPPER fehlt (muss mit Hostinger übereinstimmen).');
    process.exit(1);
  }
  return pepper;
}

function hashInviteToken(token) {
  return createHash('sha256').update(`${token}:${getPepper()}`).digest('hex');
}

function hashTempPassword(password) {
  return createHash('sha256')
    .update(`employee-invitation-password:${password}:${getPepper()}`)
    .digest('hex');
}

function generateInviteToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

function generateTempPassword(length = 14) {
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += TEMP_PASSWORD_CHARS[randomInt(0, TEMP_PASSWORD_CHARS.length)];
  }
  return password;
}

function buildInviteUrl(token) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';
  const protocol = root.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${root}/einladung/${token}`;
}

const profileId = process.argv[2];
const actorId = process.argv[3] ?? profileId;

if (!profileId) {
  console.error('Usage: node scripts/regenerate-invite-once.mjs <profileId> [actorProfileId]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Supabase URL/Service-Role fehlt in .env.local');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: profile, error: profileError } = await admin
  .from('profiles')
  .select('id, email, first_name, tenant_id, must_change_password')
  .eq('id', profileId)
  .single();

if (profileError || !profile) {
  console.error('Profil nicht gefunden:', profileError?.message);
  process.exit(1);
}

const now = new Date().toISOString();
await admin
  .from('employee_invitations')
  .update({ revoked_at: now })
  .eq('user_id', profileId)
  .is('used_at', null)
  .is('revoked_at', null);

const tempPassword = generateTempPassword();
const { token, tokenHash } = generateInviteToken();
const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

const { error: insertError } = await admin.from('employee_invitations').insert({
  tenant_id: profile.tenant_id,
  user_id: profileId,
  token_hash: tokenHash,
  temp_password_hash: hashTempPassword(tempPassword),
  expires_at: expiresAt.toISOString(),
  created_by: actorId,
});

if (insertError) {
  console.error('Insert fehlgeschlagen:', insertError.message);
  process.exit(1);
}

await admin.from('profiles').update({ must_change_password: true }).eq('id', profileId);

console.log(
  JSON.stringify(
    {
      name: `${profile.first_name}`,
      email: profile.email,
      inviteUrl: buildInviteUrl(token),
      tempPassword,
      expiresAt: expiresAt.toISOString(),
    },
    null,
    2,
  ),
);
