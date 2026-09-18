export type ExtractedDeliveryNoteItem = {
  description: string;
  quantity: number | null;
  unit: string | null;
};

export type ExtractedDeliveryNote = {
  supplierName: string | null;
  deliveryNoteNumber: string | null;
  deliveryDate: string | null;
  items: ExtractedDeliveryNoteItem[];
  summaryDescription: string | null;
};

export class DeliveryNoteExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: 'missing_api_key' | 'unsupported_file' | 'api_error' | 'parse_error',
  ) {
    super(message);
    this.name = 'DeliveryNoteExtractionError';
  }
}

const DELIVERY_NOTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    supplier_name: { type: ['string', 'null'] },
    delivery_note_number: { type: ['string', 'null'] },
    delivery_date: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD when possible' },
    summary_description: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
        },
        required: ['description', 'quantity', 'unit'],
      },
    },
  },
  required: ['supplier_name', 'delivery_note_number', 'delivery_date', 'summary_description', 'items'],
} as const;

const EXTRACTION_PROMPT = [
  'Extrahiere strukturierte Daten aus einem Lieferschein für die Baustellendokumentation.',
  'Lieferant/Firma, Lieferschein-Nummer, Lieferdatum (YYYY-MM-DD) und alle Positionen mit Beschreibung, Menge und Einheit.',
  'Bei unleserlichen Feldern null setzen. Positionsbeschreibungen auf Deutsch belassen.',
].join(' ');

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImage(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(file.name);
}

async function fileToDataUri(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  const mimeType = file.type || (isPdf(file) ? 'application/pdf' : 'image/jpeg');
  return `data:${mimeType};base64,${base64}`;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const germanMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (germanMatch) {
    const day = germanMatch[1].padStart(2, '0');
    const month = germanMatch[2].padStart(2, '0');
    const year = germanMatch[3].length === 2 ? `20${germanMatch[3]}` : germanMatch[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseAnnotation(raw: unknown): ExtractedDeliveryNote {
  let parsed: Record<string, unknown>;
  if (typeof raw === 'string') {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } else if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>;
  } else {
    throw new DeliveryNoteExtractionError('Ungültige KI-Antwort', 'parse_error');
  }

  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : [];
  const items: ExtractedDeliveryNoteItem[] = itemsRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const description = typeof row.description === 'string' ? row.description.trim() : '';
      if (!description) return null;
      const quantity = typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? row.quantity : null;
      const unit = typeof row.unit === 'string' && row.unit.trim() ? row.unit.trim() : null;
      return { description, quantity, unit };
    })
    .filter((entry): entry is ExtractedDeliveryNoteItem => entry !== null);

  return {
    supplierName: typeof parsed.supplier_name === 'string' ? parsed.supplier_name.trim() || null : null,
    deliveryNoteNumber:
      typeof parsed.delivery_note_number === 'string' ? parsed.delivery_note_number.trim() || null : null,
    deliveryDate: normalizeDate(parsed.delivery_date),
    summaryDescription:
      typeof parsed.summary_description === 'string' ? parsed.summary_description.trim() || null : null,
    items,
  };
}

export async function extractDeliveryNoteFromFile(file: File): Promise<ExtractedDeliveryNote> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new DeliveryNoteExtractionError(
      'KI-Erkennung ist nicht konfiguriert (MISTRAL_API_KEY fehlt).',
      'missing_api_key',
    );
  }

  if (!isPdf(file) && !isImage(file)) {
    throw new DeliveryNoteExtractionError(
      'Nur Fotos und PDF-Dateien werden unterstützt.',
      'unsupported_file',
    );
  }

  const dataUri = await fileToDataUri(file);
  const document = isPdf(file)
    ? { type: 'document_url' as const, document_url: dataUri }
    : { type: 'image_url' as const, image_url: dataUri };

  const response = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document,
      document_annotation_format: {
        type: 'json_schema',
        json_schema: {
          name: 'delivery_note',
          strict: true,
          schema: DELIVERY_NOTE_SCHEMA,
        },
      },
      document_annotation_prompt: EXTRACTION_PROMPT,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new DeliveryNoteExtractionError(
      `Mistral OCR fehlgeschlagen (${response.status})${errorText ? `: ${errorText.slice(0, 200)}` : ''}`,
      'api_error',
    );
  }

  const payload = (await response.json()) as { document_annotation?: unknown };
  if (!payload.document_annotation) {
    throw new DeliveryNoteExtractionError(
      'Keine strukturierten Daten im Lieferschein erkannt.',
      'parse_error',
    );
  }

  return parseAnnotation(payload.document_annotation);
}
