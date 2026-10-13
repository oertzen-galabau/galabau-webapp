import { NextResponse } from 'next/server';
import { getActionContext } from '@/lib/auth/session';
import { canAccessOrderFormPdf } from '@/lib/orders/access-order-pdf';
import { loadOrderFormData } from '@/lib/orders/load-order-form-data';
import { buildOrderFormPdf, orderFormPdfFilename } from '@/lib/orders/pdf';
import { createClient } from '@/lib/supabase/server';

function parseOrderIds(url: URL): string[] {
  const repeated = url.searchParams.getAll('order_id');
  const csv = url.searchParams.get('order_ids');
  const fromCsv = csv ? csv.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return [...new Set([...repeated, ...fromCsv])];
}

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const url = new URL(request.url);
  const orderIds = parseOrderIds(url);
  if (orderIds.length === 0) {
    return NextResponse.json({ error: 'Parameter order_id fehlt' }, { status: 400 });
  }

  const dispositionParam = url.searchParams.get('disposition');
  const disposition = dispositionParam === 'inline' ? 'inline' : 'attachment';

  const supabase = await createClient();

  type OrderOwnerRow = { id: string; user_id: string };
  const { data: owners, error: ownerError } = await supabase
    .from('catalog_orders')
    .select('id, user_id')
    .eq('tenant_id', ctx.tenantId)
    .in('id', orderIds);
  if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 500 });
  if ((owners ?? []).length !== orderIds.length) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  const orderUserIds = (owners as OrderOwnerRow[]).map((o) => o.user_id);
  if (!canAccessOrderFormPdf(ctx, { orderUserIds })) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  let formData;
  try {
    formData = await loadOrderFormData(supabase, ctx.tenantId, orderIds);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Laden fehlgeschlagen' }, { status: 400 });
  }

  const bytes = await buildOrderFormPdf({
    tenantName: formData.tenantName,
    sheets: formData.sheets,
    includeSummary: formData.sheets.length > 1,
  });
  const filename = orderFormPdfFilename(formData.sheets);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
    },
  });
}
