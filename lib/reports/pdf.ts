import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ReportPhotoInput = {
  bytes: Uint8Array;
  contentType: string | null;
  caption?: string | null;
};

export type ReportInput = {
  tenantName: string;
  siteName: string;
  reportDate: string;
  weather: string | null;
  notes: string | null;
  workItems: { description: string; worker_hours: number }[];
  equipment: { equipment_name: string; hours: number }[];
  subcontractors: { company_name: string; work_description: string | null; hours: number }[];
  deliveries: { supplier_name: string | null; description: string | null }[];
  photos?: ReportPhotoInput[];
};

const PAGE_WIDTH = 595.28; // A4 in pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

/**
 * Erzeugt ein echtes PDF-Dokument für den Bautagesrapport (statt der
 * vorherigen HTML-Datei). Läuft mit reinem JavaScript (pdf-lib) auf jedem
 * Node.js-Hosting ohne Zusatzdienst.
 */
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

  drawHeading('Bautagesrapport');
  drawLine(`${input.tenantName} · ${input.siteName} · ${input.reportDate}`);
  drawLine(`Wetter: ${input.weather ?? '—'}`);
  y -= 8;

  drawSubheading('Arbeitsleistungen');
  if (input.workItems.length) {
    for (const item of input.workItems) drawLine(`${item.description} — ${item.worker_hours} Std.`);
  } else {
    drawLine('Keine Einträge');
  }
  y -= 8;

  drawSubheading('Gerätestunden');
  if (input.equipment.length) {
    for (const item of input.equipment) drawLine(`${item.equipment_name} — ${item.hours} Std.`);
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
    for (const item of input.deliveries) drawLine(`${item.supplier_name ?? 'Lieferung'}: ${item.description ?? ''}`);
  } else {
    drawLine('Keine Lieferungen');
  }
  y -= 8;

  drawSubheading('Bemerkungen');
  drawLine(input.notes ?? '—');

  // Fotos jeweils auf einer eigenen Seite einbetten
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
      // Unbekanntes Bildformat — überspringen, restliches PDF bleibt gültig.
    }
  }

  return pdfDoc.save();
}
