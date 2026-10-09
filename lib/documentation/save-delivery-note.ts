import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePartnerName } from '@/lib/actions/partners';
import { buildStoragePath, uploadPrivateFile } from '@/lib/supabase/storage';
import type { DeliveryNoteExtractionStatus } from '@/lib/types/database';

export type DeliveryNoteItemInput = {
  description: string;
  quantity: number | null;
  unit: string | null;
};

export type DeliveryNoteBlockInput = {
  partnerId: string | null;
  supplierFreeText: string | null;
  deliveryNoteNumber: string | null;
  deliveryDate: string | null;
  description: string | null;
  extractionStatus: DeliveryNoteExtractionStatus;
  rawExtraction: Record<string, unknown> | null;
  file: File | null;
  items: DeliveryNoteItemInput[];
};

function normalizeExtractionStatus(value: string): DeliveryNoteExtractionStatus {
  if (value === 'pending' || value === 'success' || value === 'failed' || value === 'manual') {
    return value;
  }
  return 'manual';
}

export function parseRawExtraction(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isDeliveryBlockEmpty(block: DeliveryNoteBlockInput): boolean {
  const hasSupplier =
    Boolean(block.partnerId) || Boolean(String(block.supplierFreeText ?? '').trim());
  const hasFile = block.file instanceof File && block.file.size > 0;
  const hasMeta =
    Boolean(String(block.deliveryNoteNumber ?? '').trim()) ||
    Boolean(String(block.deliveryDate ?? '').trim()) ||
    Boolean(String(block.description ?? '').trim());
  const hasItems = block.items.some((item) => item.description.trim());
  return !hasSupplier && !hasFile && !hasMeta && !hasItems;
}

export async function insertDeliveryNote(
  supabase: SupabaseClient,
  tenantId: string,
  dailyLogId: string,
  block: DeliveryNoteBlockInput,
) {
  if (isDeliveryBlockEmpty(block)) return;

  let resolvedPartnerId: string | null = null;
  let supplierName: string | null = null;
  if (block.partnerId || String(block.supplierFreeText ?? '').trim()) {
    const resolved = await resolvePartnerName(
      tenantId,
      block.partnerId,
      block.supplierFreeText,
      'supplier',
    );
    resolvedPartnerId = resolved.partnerId;
    supplierName = resolved.displayName;
  }

  let fileUrl: string | null = null;
  if (block.file instanceof File && block.file.size > 0) {
    const path = buildStoragePath(tenantId, 'lieferungen', dailyLogId, `${Date.now()}-${block.file.name}`);
    fileUrl = await uploadPrivateFile(tenantId, 'daily-photos', path, block.file);
  }

  const { data: deliveryNote, error } = await supabase
    .from('delivery_notes')
    .insert({
      tenant_id: tenantId,
      daily_log_id: dailyLogId,
      partner_id: resolvedPartnerId,
      supplier_name: supplierName,
      delivery_note_number: block.deliveryNoteNumber,
      delivery_date: block.deliveryDate || null,
      description: block.description,
      file_url: fileUrl,
      extraction_status: block.extractionStatus,
      raw_extraction: block.rawExtraction,
    })
    .select('id')
    .single();

  if (error || !deliveryNote) throw new Error(error?.message ?? 'Fehler beim Speichern der Lieferung');

  const items = block.items
    .filter((item) => item.description.trim())
    .map((item, index) => ({
      tenant_id: tenantId,
      delivery_note_id: deliveryNote.id,
      position: index + 1,
      description: item.description.trim(),
      quantity: item.quantity,
      unit: item.unit,
    }));

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('delivery_note_items').insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }
}

export function deliveryBlockFromStandaloneForm(formData: FormData): DeliveryNoteBlockInput {
  const partnerIdRaw = (formData.get('partner_id') as string)?.trim() || null;
  const partnerId = partnerIdRaw && partnerIdRaw !== '__custom__' ? partnerIdRaw : null;
  const extractionStatusRaw = (formData.get('extraction_status') as string) || 'manual';
  const file = formData.get('delivery_file');
  const itemDescriptions = formData.getAll('item_description[]');
  const itemQuantities = formData.getAll('item_quantity[]');
  const itemUnits = formData.getAll('item_unit[]');
  const rowCount = Math.max(itemDescriptions.length, itemQuantities.length, itemUnits.length);
  const items: DeliveryNoteItemInput[] = [];

  for (let i = 0; i < rowCount; i++) {
    const description = String(itemDescriptions[i] ?? '').trim();
    if (!description) continue;
    const quantityRaw = String(itemQuantities[i] ?? '').trim();
    const quantity = quantityRaw ? Number(quantityRaw) : null;
    items.push({
      description,
      quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
      unit: String(itemUnits[i] ?? '').trim() || null,
    });
  }

  return {
    partnerId,
    supplierFreeText: (formData.get('supplier_name') as string) || null,
    deliveryNoteNumber: (formData.get('delivery_note_number') as string) || null,
    deliveryDate: (formData.get('delivery_date') as string) || null,
    description: (formData.get('description') as string) || null,
    extractionStatus: normalizeExtractionStatus(extractionStatusRaw),
    rawExtraction: parseRawExtraction(String(formData.get('raw_extraction') ?? '')),
    file: file instanceof File && file.size > 0 ? file : null,
    items,
  };
}
