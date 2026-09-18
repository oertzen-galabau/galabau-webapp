'use server';

import type { ExtractedDeliveryNote } from '@/lib/ai/delivery-note-extraction';
import {
  DeliveryNoteExtractionError,
  extractDeliveryNoteFromFile,
} from '@/lib/ai/delivery-note-extraction';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

export type ExtractDeliveryNoteResult =
  | { ok: true; data: ExtractedDeliveryNote }
  | { ok: false; error: string; code?: string };

export async function extractDeliveryNoteData(formData: FormData): Promise<ExtractDeliveryNoteResult> {
  const ctx = await getActionContext();
  requirePerm(ctx, 'documentation.manage');

  const file = formData.get('delivery_file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Bitte zuerst ein Foto oder PDF auswählen.' };
  }

  try {
    const data = await extractDeliveryNoteFromFile(file);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof DeliveryNoteExtractionError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return { ok: false, error: 'Daten konnten nicht ausgelesen werden.' };
  }
}
