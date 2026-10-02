import { parseProductPageHtml, type ProductImportSuggestion } from '@/lib/catalog/parse-product-page';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 512 * 1024;

export class CatalogFetchError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_url' | 'blocked' | 'fetch_failed' | 'too_large',
  ) {
    super(message);
    this.name = 'CatalogFetchError';
  }
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;

  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  if (h.includes(':')) {
    if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  }

  return false;
}

export function assertSafeHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new CatalogFetchError('Ungültige URL', 'invalid_url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CatalogFetchError('Nur http(s)-Links sind erlaubt', 'invalid_url');
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new CatalogFetchError('Diese Adresse ist nicht erlaubt', 'blocked');
  }
  return parsed;
}

async function readLimitedBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new CatalogFetchError('Antwort zu groß', 'too_large');
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new CatalogFetchError('Antwort zu groß', 'too_large');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

export async function fetchProductSuggestionFromUrl(rawUrl: string): Promise<ProductImportSuggestion> {
  let current = assertSafeHttpUrl(rawUrl);
  let response: Response | null = null;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'VaerkflowCatalogBot/1.0',
        },
      });
    } catch {
      throw new CatalogFetchError('Shop-Seite konnte nicht geladen werden', 'fetch_failed');
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new CatalogFetchError('Weiterleitung ohne Ziel', 'fetch_failed');
      current = assertSafeHttpUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new CatalogFetchError(`Shop antwortete mit Status ${response.status}`, 'fetch_failed');
    }
    break;
  }

  if (!response?.ok) {
    throw new CatalogFetchError('Shop-Seite konnte nicht geladen werden', 'fetch_failed');
  }

  const html = await readLimitedBody(response);
  return parseProductPageHtml(html);
}
