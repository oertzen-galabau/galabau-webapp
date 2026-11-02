import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;
const SCRYPT_SALT = 'galabau-smtp-v1';

function encryptionKey(): Buffer {
  const raw = process.env.SMTP_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 16) {
    throw new Error('SMTP_ENCRYPTION_KEY ist nicht konfiguriert.');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return scryptSync(raw, SCRYPT_SALT, KEY_LEN);
}

export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Ungültiges Passwort-Format.');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = encryptionKey();
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function hasEncryptionKeyConfigured(): boolean {
  const raw = process.env.SMTP_ENCRYPTION_KEY?.trim();
  return Boolean(raw && raw.length >= 16);
}
