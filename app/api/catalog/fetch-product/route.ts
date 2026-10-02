import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { CatalogFetchError, fetchProductSuggestionFromUrl } from '@/lib/catalog/fetch-product-url';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  if (!canAccess(ctx, 'orders.manage_catalog')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: 'URL fehlt' }, { status: 400 });
  }

  try {
    const suggestion = await fetchProductSuggestionFromUrl(url);
    return NextResponse.json({ suggestion });
  } catch (error) {
    if (error instanceof CatalogFetchError) {
      const status = error.code === 'invalid_url' || error.code === 'blocked' ? 400 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
