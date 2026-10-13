import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { canAccessOrderFormPdf } from '@/lib/orders/access-order-pdf';
import { formatOrderFormDate } from '@/lib/orders/form-rows';
import { loadOrderFormData } from '@/lib/orders/load-order-form-data';
import { buildOrderFormPdf, orderFormPdfFilename } from '@/lib/orders/pdf';
import { sendMail, getDefaultMailRecipient, sendMailFailureText } from '@/lib/email/smtp';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1),
  to: z.string().email().optional(),
  extraEmails: z.array(z.string().email()).optional(),
  markAsOrdered: z.boolean().optional(),
});

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  if (!canAccess(ctx, 'orders.share')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const { orderIds, to, extraEmails, markAsOrdered } = parsed;
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

  const subject =
    formData.sheets.length === 1
      ? `Bestellformular ${formData.sheets[0].employeeName} (${formatOrderFormDate(formData.sheets[0].orderDateIso)}) – ${formData.tenantName}`
      : `Sammelbestellung (${formData.sheets.length} Formulare) – ${formData.tenantName}`;

  const textBody =
    formData.sheets.length === 1
      ? `Anbei das Bestellformular für ${formData.sheets[0].employeeName} (${formData.tenantName}).`
      : `Anbei ${formData.sheets.length} Bestellformulare für ${formData.tenantName}.`;

  const recipients = new Set<string>();
  if (to?.trim()) recipients.add(to.trim());
  for (const e of extraEmails ?? []) {
    if (e?.trim()) recipients.add(e.trim());
  }
  if (!recipients.size) {
    const fallback = getDefaultMailRecipient();
    if (fallback) recipients.add(fallback);
  }
  if (!recipients.size) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: 'Kein Empfänger angegeben und SMTP nicht konfiguriert.',
    });
  }

  const results = await Promise.all(
    [...recipients].map((recipient) =>
      sendMail({
        to: recipient,
        subject,
        text: textBody,
        attachments: [{ filename, content: Buffer.from(bytes), contentType: 'application/pdf' }],
      }),
    ),
  );

  const failed = results.find((r) => !r.ok);
  if (failed) {
    return NextResponse.json({ error: sendMailFailureText(failed) }, { status: 500 });
  }

  if (markAsOrdered && canAccess(ctx, 'orders.manage')) {
    const { error: statusError } = await supabase
      .from('catalog_orders')
      .update({ status: 'ordered', updated_at: new Date().toISOString() })
      .eq('tenant_id', ctx.tenantId)
      .in('id', orderIds);
    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, sent: recipients.size, markedOrdered: Boolean(markAsOrdered) });
}
