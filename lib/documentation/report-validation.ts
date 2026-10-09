import { MAX_REPORT_PHOTOS, MIN_REPORT_PHOTOS, REPORT_UNIT_OPTIONS } from '@/lib/types/database';

export { MIN_REPORT_PHOTOS, MAX_REPORT_PHOTOS, REPORT_UNIT_OPTIONS };

export type WorkerHoursInput = {
  userId: string | null;
  workerName: string;
  jobTitle: string | null;
  hours: number;
};

export type WorkItemInput = {
  description: string;
  quantity: number | null;
  unit: string | null;
};

export type ResourceInput = {
  name: string;
  quantity: number | null;
  unit: string | null;
  hours: number | null;
};

export type SubcontractorPersonRowInput = {
  groupKey: string;
  partnerId: string | null;
  companyName: string;
  workDescription: string | null;
  workerName: string | null;
  hours: number;
};

import type { DeliveryNoteBlockInput } from '@/lib/documentation/save-delivery-note';
import { isDeliveryBlockEmpty, parseRawExtraction } from '@/lib/documentation/save-delivery-note';
import type { DeliveryNoteExtractionStatus } from '@/lib/types/database';

export type SignatureInput = {
  role: 'contractor' | 'client';
  signerName: string | null;
  dataUrl: string | null;
  keepExisting: boolean;
  remove: boolean;
  signedAt: string | null;
  signedLatitude: number | null;
  signedLongitude: number | null;
  signedLocationLabel: string | null;
};

function parseCoordinate(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function assertSignatureMetadata(signature: SignatureInput) {
  if (!signature.dataUrl) return;

  if (!signature.signedAt) {
    throw new Error('Unterschrift: Zeitpunkt fehlt. Bitte erneut unterschreiben.');
  }

  const signedAt = new Date(signature.signedAt);
  if (Number.isNaN(signedAt.getTime())) {
    throw new Error('Unterschrift: Ungültiger Zeitpunkt. Bitte erneut unterschreiben.');
  }

  if (signature.signedLatitude == null || signature.signedLongitude == null) {
    throw new Error(
      'Unterschrift: Standort konnte nicht erfasst werden. Bitte Ortungsfreigabe aktivieren und erneut unterschreiben.',
    );
  }

  if (
    signature.signedLatitude < -90 ||
    signature.signedLatitude > 90 ||
    signature.signedLongitude < -180 ||
    signature.signedLongitude > 180
  ) {
    throw new Error('Unterschrift: Ungültige Standortdaten. Bitte erneut unterschreiben.');
  }
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseOptionalUnit(value: FormDataEntryValue | null): string | null {
  const unit = String(value ?? '').trim();
  if (!unit) return null;
  if (!(REPORT_UNIT_OPTIONS as readonly string[]).includes(unit)) {
    throw new Error(`Ungültige Einheit: ${unit}`);
  }
  return unit;
}

export function parseWorkerHoursRows(formData: FormData): WorkerHoursInput[] {
  const userIds = formData.getAll('worker_user_id[]');
  const names = formData.getAll('worker_name[]');
  const titles = formData.getAll('worker_job_title[]');
  const hoursList = formData.getAll('worker_hours_row[]');
  const rowCount = Math.max(userIds.length, names.length, titles.length, hoursList.length);
  const rows: WorkerHoursInput[] = [];

  for (let i = 0; i < rowCount; i++) {
    const userId = String(userIds[i] ?? '').trim() || null;
    const workerName = String(names[i] ?? '').trim();
    const hours = parseNumber(hoursList[i]) ?? 0;
    if (!userId && !workerName) continue;
    if (!workerName && !userId) continue;
    rows.push({
      userId,
      workerName,
      jobTitle: String(titles[i] ?? '').trim() || null,
      hours,
    });
  }

  return rows;
}

export function parseWorkItemRows(formData: FormData): WorkItemInput[] {
  const descriptions = formData.getAll('work_description[]');
  const quantities = formData.getAll('work_quantity[]');
  const units = formData.getAll('work_unit[]');
  const rowCount = Math.max(descriptions.length, quantities.length, units.length);
  const rows: WorkItemInput[] = [];

  for (let i = 0; i < rowCount; i++) {
    const description = String(descriptions[i] ?? '').trim();
    if (!description) continue;
    rows.push({
      description,
      quantity: parseNumber(quantities[i]),
      unit: parseOptionalUnit(units[i]),
    });
  }

  return rows;
}

export function parseSubcontractorPersonRows(formData: FormData): SubcontractorPersonRowInput[] {
  const groupKeys = formData.getAll('subcontractor_group_key[]');
  const partnerIds = formData.getAll('subcontractor_partner_id[]');
  const companyNames = formData.getAll('subcontractor_company_name[]');
  const descriptions = formData.getAll('subcontractor_work_description[]');
  const workerNames = formData.getAll('subcontractor_worker_name[]');
  const hoursList = formData.getAll('subcontractor_hours[]');
  const rowCount = Math.max(
    groupKeys.length,
    partnerIds.length,
    companyNames.length,
    descriptions.length,
    workerNames.length,
    hoursList.length,
  );

  const byGroup = new Map<
    string,
    {
      partnerId: string | null;
      companyName: string;
      workDescription: string | null;
      persons: SubcontractorPersonRowInput[];
    }
  >();

  for (let i = 0; i < rowCount; i++) {
    const groupKey = String(groupKeys[i] ?? '').trim();
    if (!groupKey) continue;

    const partnerRaw = String(partnerIds[i] ?? '').trim();
    const partnerId = partnerRaw && partnerRaw !== '__custom__' ? partnerRaw : null;
    const companyName = String(companyNames[i] ?? '').trim();
    const workDescription = String(descriptions[i] ?? '').trim() || null;
    const workerName = String(workerNames[i] ?? '').trim() || null;
    const hours = parseNumber(hoursList[i]) ?? 0;

    if (!workerName && hours <= 0) continue;

    let group = byGroup.get(groupKey);
    if (!group) {
      group = {
        partnerId,
        companyName,
        workDescription,
        persons: [],
      };
      byGroup.set(groupKey, group);
    }

    if (partnerId) group.partnerId = partnerId;
    if (companyName) group.companyName = companyName;
    if (workDescription) group.workDescription = workDescription;

    group.persons.push({
      groupKey,
      partnerId: group.partnerId,
      companyName: group.companyName,
      workDescription: group.workDescription,
      workerName,
      hours,
    });
  }

  const rows: SubcontractorPersonRowInput[] = [];
  for (const group of byGroup.values()) {
    if (!group.partnerId && !group.companyName) continue;
    if (group.persons.length === 0) continue;
    for (const person of group.persons) {
      rows.push({
        ...person,
        partnerId: group.partnerId,
        companyName: group.companyName,
        workDescription: group.workDescription,
      });
    }
  }

  return rows;
}

function normalizeDeliveryExtractionStatus(value: string): DeliveryNoteExtractionStatus {
  if (value === 'pending' || value === 'success' || value === 'failed' || value === 'manual') {
    return value;
  }
  return 'manual';
}

function parseDeliveryItemsForPrefix(formData: FormData, prefix: string) {
  const itemDescriptions = formData.getAll(`${prefix}_item_description[]`);
  const itemQuantities = formData.getAll(`${prefix}_item_quantity[]`);
  const itemUnits = formData.getAll(`${prefix}_item_unit[]`);
  const rowCount = Math.max(itemDescriptions.length, itemQuantities.length, itemUnits.length);
  const items: DeliveryNoteBlockInput['items'] = [];

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

  return items;
}

export function parseDeliveryBlockAtIndex(formData: FormData, index: number): DeliveryNoteBlockInput {
  const prefix = `delivery_${index}`;
  const partnerIdRaw = String(formData.get(`${prefix}_partner_id`) ?? '').trim();
  const partnerId = partnerIdRaw && partnerIdRaw !== '__custom__' ? partnerIdRaw : null;
  const file = formData.get(`${prefix}_file`);
  const extractionStatusRaw = String(formData.get(`${prefix}_extraction_status`) ?? 'manual');

  return {
    partnerId,
    supplierFreeText: String(formData.get(`${prefix}_supplier_name`) ?? '').trim() || null,
    deliveryNoteNumber: String(formData.get(`${prefix}_delivery_note_number`) ?? '').trim() || null,
    deliveryDate: String(formData.get(`${prefix}_delivery_date`) ?? '').trim() || null,
    description: String(formData.get(`${prefix}_description`) ?? '').trim() || null,
    extractionStatus: normalizeDeliveryExtractionStatus(extractionStatusRaw),
    rawExtraction: parseRawExtraction(String(formData.get(`${prefix}_raw_extraction`) ?? '')),
    file: file instanceof File && file.size > 0 ? file : null,
    items: parseDeliveryItemsForPrefix(formData, prefix),
  };
}

export function parseDeliveryBlocks(formData: FormData): DeliveryNoteBlockInput[] {
  const countRaw = Number(formData.get('delivery_block_count') ?? 0);
  const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.floor(countRaw) : 0;
  const blocks: DeliveryNoteBlockInput[] = [];

  for (let i = 0; i < count; i++) {
    const block = parseDeliveryBlockAtIndex(formData, i);
    if (!isDeliveryBlockEmpty(block)) blocks.push(block);
  }

  return blocks;
}

export function parseResourceRows(formData: FormData): ResourceInput[] {
  const names = formData.getAll('resource_name[]');
  const quantities = formData.getAll('resource_quantity[]');
  const units = formData.getAll('resource_unit[]');
  const hoursList = formData.getAll('resource_hours[]');
  const rowCount = Math.max(names.length, quantities.length, units.length, hoursList.length);
  const rows: ResourceInput[] = [];

  for (let i = 0; i < rowCount; i++) {
    const name = String(names[i] ?? '').trim();
    if (!name) continue;
    rows.push({
      name,
      quantity: parseNumber(quantities[i]),
      unit: parseOptionalUnit(units[i]),
      hours: parseNumber(hoursList[i]),
    });
  }

  return rows;
}

export function parseSignatureInputs(formData: FormData): SignatureInput[] {
  const roles: Array<'contractor' | 'client'> = ['contractor', 'client'];
  return roles.map((role) => ({
    role,
    signerName: String(formData.get(`${role}_signer_name`) ?? '').trim() || null,
    dataUrl: String(formData.get(`${role}_signature_data`) ?? '').trim() || null,
    keepExisting: formData.get(`${role}_signature_keep`) === '1',
    remove: formData.get(`${role}_signature_remove`) === '1',
    signedAt: String(formData.get(`${role}_signature_signed_at`) ?? '').trim() || null,
    signedLatitude: parseCoordinate(formData.get(`${role}_signature_latitude`)),
    signedLongitude: parseCoordinate(formData.get(`${role}_signature_longitude`)),
    signedLocationLabel: String(formData.get(`${role}_signature_location_label`) ?? '').trim() || null,
  }));
}

export function validatePhotoCount(existingActive: number, newFiles: number, removedIds: number) {
  const total = existingActive - removedIds + newFiles;
  if (total < MIN_REPORT_PHOTOS) {
    throw new Error(`Mindestens ${MIN_REPORT_PHOTOS} Fotos erforderlich (aktuell: ${total}).`);
  }
  if (total > MAX_REPORT_PHOTOS) {
    throw new Error(`Maximal ${MAX_REPORT_PHOTOS} Fotos erlaubt (aktuell: ${total}).`);
  }
  return total;
}

export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Ungültige Signatur-Daten');
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}
