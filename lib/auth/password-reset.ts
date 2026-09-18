import { createHash, randomInt } from 'crypto';

export const RESET_EMAIL_SESSION_KEY = 'password_reset_email';

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;
export const MAX_REQUESTS_PER_HOUR = 3;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateResetCode() {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

function getPepper() {
  const pepper = process.env.PASSWORD_RESET_PEPPER;
  if (pepper) return pepper;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PASSWORD_RESET_PEPPER fehlt in der Produktionsumgebung.');
  }
  return 'dev-only-pepper';
}

export function hashResetCode(code: string) {
  return createHash('sha256').update(`${code}:${getPepper()}`).digest('hex');
}

export function getCodeExpiry() {
  return new Date(Date.now() + CODE_TTL_MS);
}

export function isRateLimitWindowStart() {
  return new Date(Date.now() - 60 * 60 * 1000);
}
