import { normalizePriceString } from '@/lib/catalog/normalize-price';

export type ProductImportSuggestion = {
  clothingStyle?: string;
  articleNumber?: string;
  price?: number;
  message?: string;
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function metaContent(html: string, attr: 'property' | 'name', key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`,
    'i',
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`,
    'i',
  );
  const m = html.match(re) ?? html.match(alt);
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : null;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return blocks;
}

function isProductNode(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type.toLowerCase() === 'product';
  if (Array.isArray(type)) return type.some((t) => String(t).toLowerCase() === 'product');
  return false;
}

function collectProductNodes(data: unknown, out: Record<string, unknown>[]) {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data)) {
    for (const item of data) collectProductNodes(item, out);
    return;
  }
  const obj = data as Record<string, unknown>;
  if (isProductNode(obj)) out.push(obj);
  if (obj['@graph']) collectProductNodes(obj['@graph'], out);
}

function priceFromOffer(offer: unknown): number | null {
  if (!offer || typeof offer !== 'object') return null;
  const offers = Array.isArray(offer) ? offer : [offer];
  for (const o of offers) {
    if (!o || typeof o !== 'object') continue;
    const rec = o as Record<string, unknown>;
    const price = rec.price ?? rec.lowPrice ?? rec.highPrice;
    if (price != null) {
      const normalized = normalizePriceString(String(price));
      if (normalized != null) return normalized;
    }
  }
  return null;
}

function skuFromProduct(product: Record<string, unknown>): string | null {
  const sku = product.sku ?? product.mpn ?? product.gtin ?? product.productID;
  if (sku == null) return null;
  const s = String(sku).trim();
  return s || null;
}

function mergeSuggestion(
  base: ProductImportSuggestion,
  patch: ProductImportSuggestion,
): ProductImportSuggestion {
  return {
    clothingStyle: base.clothingStyle ?? patch.clothingStyle,
    articleNumber: base.articleNumber ?? patch.articleNumber,
    price: base.price ?? patch.price,
    message: base.message ?? patch.message,
  };
}

export function parseProductPageHtml(html: string): ProductImportSuggestion {
  let result: ProductImportSuggestion = {};

  const ogTitle = metaContent(html, 'property', 'og:title');
  const ogPrice = metaContent(html, 'property', 'product:price:amount')
    ?? metaContent(html, 'property', 'og:price:amount');

  if (ogTitle) result = mergeSuggestion(result, { clothingStyle: ogTitle });
  const ogPriceNorm = normalizePriceString(ogPrice);
  if (ogPriceNorm != null) result = mergeSuggestion(result, { price: ogPriceNorm });

  const blocks = extractJsonLdBlocks(html);
  const products: Record<string, unknown>[] = [];
  for (const block of blocks) collectProductNodes(block, products);

  for (const product of products) {
    const name = product.name != null ? String(product.name).trim() : '';
    const sku = skuFromProduct(product);
    const price = priceFromOffer(product.offers);
    if (name) result = mergeSuggestion(result, { clothingStyle: name });
    if (sku) result = mergeSuggestion(result, { articleNumber: sku });
    if (price != null) result = mergeSuggestion(result, { price });
  }

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (titleTag && !result.clothingStyle) {
    const t = decodeHtmlEntities(titleTag.trim());
    if (t) result = mergeSuggestion(result, { clothingStyle: t });
  }

  const hasAny = result.clothingStyle || result.articleNumber || result.price != null;
  if (!hasAny) {
    result.message =
      'Keine Produktdaten in der Seite gefunden. Felder bitte manuell ausfüllen.';
  }

  return result;
}
