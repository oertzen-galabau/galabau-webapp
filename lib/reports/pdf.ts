import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ReportPhotoInput = {
  bytes: Uint8Array;
  contentType: string | null;
  caption?: string | null;
};

export type ReportSignatureInput = {
  role: 'contractor' | 'client';
  signerName: string | null;
  bytes: Uint8Array;
  contentType: string | null;
  signedAt?: string | null;
  signedLocationLabel?: string | null;
  signedLatitude?: number | null;
  signedLongitude?: number | null;
};

export type ReportInput = {
  tenantName: string;
  clientName: string | null;
  siteName: string;
  siteAddress: string | null;
  reportDate: string;
  weather: string | null;
  notes: string | null;
  workers: { worker_name: string; job_title: string | null; hours: number }[];
  workItems: { description: string; quantity: number | null; unit: string | null }[];
  resources: { equipment_name: string; quantity: number | null; unit: string | null; hours: number }[];
  subcontractors: { company_name: string; work_description: string | null; hours: number }[];
  deliveries: {
    supplier_name: string | null;
    description: string | null;
    items: { description: string; quantity: number | null; unit: string | null }[];
  }[];
  photos?: ReportPhotoInput[];
  signatures?: ReportSignatureInput[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

function formatQuantityLine(quantity: number | null, unit: string | null, hours?: number) {
  const parts: string[] = [];
  if (quantity != null) parts.push(String(quantity));
  if (unit) parts.push(unit);
  if (hours && hours > 0 && unit !== 'Std.') parts.push(`${hours} Std.`);
  return parts.length ? ` — ${parts.join(' ')}` : '';
}

export async function buildReportPdf(input: ReportInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawHeading = (text: string, size = 18) => {
    ensureSpace(size + 12);
    page.drawText(text, { x: MARGIN, y, size, font: boldFont, color: rgb(0.13, 0.15, 0.2) });
    y -= size + 12;
  };

  const drawSubheading = (text: string) => {
    ensureSpace(24);
    page.drawText(text, { x: MARGIN, y, size: 12, font: boldFont, color: rgb(0.13, 0.15, 0.2) });
    y -= 18;
  };

  const drawLine = (text: string) => {
    const clean = text.length > 110 ? `${text.slice(0, 107)}...` : text;
    ensureSpace(16);
    page.drawText(clean, { x: MARGIN, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 14;
  };

  drawHeading('Rapportzettel – Stundenlohn-Arbeiten');
  drawLine(`Auftragnehmer: ${input.tenantName}`);
  drawLine(`Auftraggeber: ${input.clientName ?? '—'}`);
  drawLine(`Baustelle: ${input.siteName}`);
  if (input.siteAddress) drawLine(`Adresse: ${input.siteAddress}`);
  drawLine(`Datum: ${input.reportDate}`);
  drawLine(`Wetter: ${input.weather ?? '—'}`);
  y -= 8;

  drawSubheading('Lohn / Mitarbeiter');
  if (input.workers.length) {
    for (const worker of input.workers) {
      drawLine(`${worker.worker_name}${worker.job_title ? ` (${worker.job_title})` : ''} — ${worker.hours} Std.`);
    }
    const totalHours = input.workers.reduce((sum, worker) => sum + worker.hours, 0);
    drawLine(`Gesamt: ${totalHours} Std.`);
  } else {
    drawLine('Keine Einträge');
  }
  y -= 8;

  drawSubheading('Bezeichnung der Leistung');
  if (input.workItems.length) {
    for (const item of input.workItems) {
      drawLine(`${item.description}${formatQuantityLine(item.quantity, item.unit)}`);
    }
  } else {
    drawLine('Keine Einträge');
  }
  y -= 8;

  drawSubheading('Maschine / Material');
  if (input.resources.length) {
    for (const item of input.resources) {
      drawLine(`${item.equipment_name}${formatQuantityLine(item.quantity, item.unit, item.hours)}`);
    }
  } else {
    drawLine('Keine Einträge');
  }
  y -= 8;

  drawSubheading('Subunternehmer');
  if (input.subcontractors.length) {
    for (const item of input.subcontractors) {
      drawLine(`${item.company_name} — ${item.work_description ?? ''} — ${item.hours} Std.`);
    }
  } else {
    drawLine('Keine Einträge');
  }
  y -= 8;

  drawSubheading('Lieferungen');
  if (input.deliveries.length) {
    for (const item of input.deliveries) {
      drawLine(`${item.supplier_name ?? 'Lieferung'}: ${item.description ?? ''}`);
      for (const position of item.items) {
        drawLine(`  · ${position.description}${formatQuantityLine(position.quantity, position.unit)}`);
      }
    }
  } else {
    drawLine('Keine Lieferungen');
  }
  y -= 8;

  drawSubheading('Bemerkung');
  drawLine(input.notes ?? '—');

  if (input.signatures?.length) {
    y -= 8;
    drawSubheading('Unterschriften');
    for (const signature of input.signatures) {
      const label = signature.role === 'contractor' ? 'Auftragnehmer' : 'Auftraggeber';
      drawLine(`${label}: ${signature.signerName ?? '—'}`);
      if (
        signature.signedAt &&
        signature.signedLatitude != null &&
        signature.signedLongitude != null
      ) {
        const when = new Date(signature.signedAt);
        const timeText = Number.isNaN(when.getTime())
          ? signature.signedAt
          : when.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
        const where =
          signature.signedLocationLabel?.trim() ||
          `${signature.signedLatitude.toFixed(5)}, ${signature.signedLongitude.toFixed(5)}`;
        drawLine(`Erfasst: ${timeText} · ${where}`);
      }
      try {
        const isPng = (signature.contentType ?? '').includes('png');
        const image = isPng
          ? await pdfDoc.embedPng(signature.bytes)
          : await pdfDoc.embedJpg(signature.bytes);
        ensureSpace(80);
        const w = Math.min(140, image.width);
        const h = (image.height / image.width) * w;
        page.drawImage(image, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 12;
      } catch {
        drawLine('(Signatur nicht darstellbar)');
      }
    }
  }

  for (const photo of input.photos ?? []) {
    try {
      const isPng = (photo.contentType ?? '').includes('png');
      const image = isPng ? await pdfDoc.embedPng(photo.bytes) : await pdfDoc.embedJpg(photo.bytes);
      const photoPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const maxWidth = PAGE_WIDTH - MARGIN * 2;
      const maxHeight = PAGE_HEIGHT - MARGIN * 2 - 24;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      photoPage.drawImage(image, {
        x: (PAGE_WIDTH - w) / 2,
        y: PAGE_HEIGHT - MARGIN - h,
        width: w,
        height: h,
      });
      if (photo.caption) {
        photoPage.drawText(photo.caption, {
          x: MARGIN,
          y: MARGIN / 2,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    } catch {
      // Unbekanntes Bildformat überspringen
    }
  }

  return pdfDoc.save();
}
