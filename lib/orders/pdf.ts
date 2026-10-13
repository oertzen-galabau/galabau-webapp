import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatOrderEuro } from '@/lib/orders/labels';
import { formatOrderFormDate, groupItemsByCategory } from '@/lib/orders/form-rows';
import type { OrderFormSheet } from '@/lib/orders/load-order-form-data';

/** A4 quer – breite Tabelle wie Vorlage. */
const A4_LANDSCAPE = [841.89, 595.28] as const;
const MARGIN = 40;
const ROW_H = 13;
const HEADER_H = 16;

const COL = {
  article: 40,
  style: 200,
  series: 95,
  size: 55,
  qty: 40,
  net: 65,
  print: 280,
} as const;

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = text.replace(/\s+/g, ' ').trim() || '—';
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let s = clean;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function drawOrderSheet(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  tenantName: string,
  sheet: OrderFormSheet,
) {
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  page.drawText('Bestellformular', { x: MARGIN, y, size: 14, font: fonts.bold });
  y -= 18;
  page.drawText(tenantName, { x: MARGIN, y, size: 10, font: fonts.regular });
  y -= 16;

  page.drawText(`Name: ${sheet.employeeName}`, { x: MARGIN, y, size: 10, font: fonts.regular });
  page.drawText(`Datum: ${formatOrderFormDate(sheet.orderDateIso)}`, {
    x: width - MARGIN - 160,
    y,
    size: 10,
    font: fonts.regular,
  });
  y -= 22;

  const tableRight = MARGIN + COL.article + COL.style + COL.series + COL.size + COL.qty + COL.net + COL.print;
  const headerY = y;
  page.drawRectangle({
    x: MARGIN,
    y: headerY - HEADER_H + 4,
    width: tableRight - MARGIN,
    height: HEADER_H,
    color: rgb(0.93, 0.93, 0.93),
  });

  let cx = MARGIN + 4;
  const headerSize = 8;
  const headers: { label: string; w: number }[] = [
    { label: 'Artikelnr.', w: COL.article },
    { label: 'Kleidungsstück', w: COL.style },
    { label: 'Serie', w: COL.series },
    { label: 'Größe', w: COL.size },
    { label: 'Stk.', w: COL.qty },
    { label: 'Netto', w: COL.net },
    { label: 'Namensdruck', w: COL.print },
  ];
  for (const h of headers) {
    page.drawText(h.label, { x: cx, y: headerY - 10, size: headerSize, font: fonts.bold });
    cx += h.w;
  }
  y = headerY - HEADER_H - 2;

  const cellSize = 8;
  const groups = groupItemsByCategory(sheet.items);

  for (const group of groups) {
    page.drawText(group.category, {
      x: MARGIN + 4,
      y: y - 9,
      size: 9,
      font: fonts.bold,
    });
    y -= ROW_H;

    for (const item of group.items) {
      cx = MARGIN + 4;
      const cells = [
        { text: item.article_number ?? '—', w: COL.article },
        { text: item.clothing_style, w: COL.style },
        { text: item.series ?? '—', w: COL.series },
        { text: item.size, w: COL.size },
        { text: String(item.quantity), w: COL.qty },
        {
          text: item.unit_price_eur != null ? formatOrderEuro(item.unit_price_eur) : '—',
          w: COL.net,
        },
        { text: item.name_print ?? '—', w: COL.print },
      ];
      for (const cell of cells) {
        page.drawText(truncate(cell.text, fonts.regular, cellSize, cell.w - 6), {
          x: cx,
          y: y - 9,
          size: cellSize,
          font: fonts.regular,
        });
        cx += cell.w;
      }
      y -= ROW_H;
    }
    y -= 4;
  }

  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: tableRight, y: y + 6 },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  page.drawText(`Summe Katalog: ${formatOrderEuro(sheet.catalogSumEur)}`, {
    x: MARGIN + COL.article + COL.style + COL.series,
    y: y - 10,
    size: 10,
    font: fonts.bold,
  });
}

function drawSummaryPage(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  tenantName: string,
  sheets: OrderFormSheet[],
  grandTotalEur: number,
) {
  const { height } = page.getSize();
  let y = height - MARGIN;

  page.drawText('Sammelübersicht Bestellungen', { x: MARGIN, y, size: 14, font: fonts.bold });
  y -= 18;
  page.drawText(tenantName, { x: MARGIN, y, size: 10, font: fonts.regular });
  y -= 24;

  for (const sheet of sheets) {
    page.drawText(
      `${formatOrderFormDate(sheet.orderDateIso)} · ${sheet.employeeName} · ${formatOrderEuro(sheet.catalogSumEur)}`,
      { x: MARGIN, y, size: 9, font: fonts.regular },
    );
    y -= ROW_H;
  }

  y -= 12;
  page.drawText(`Gesamtsumme Katalog: ${formatOrderEuro(grandTotalEur)}`, {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.bold,
  });
}

export async function buildOrderFormPdf(input: {
  tenantName: string;
  sheets: OrderFormSheet[];
  includeSummary?: boolean;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  for (const sheet of input.sheets) {
    const page = pdfDoc.addPage([...A4_LANDSCAPE]);
    drawOrderSheet(page, fonts, input.tenantName, sheet);
  }

  if (input.includeSummary && input.sheets.length > 1) {
    const grandTotal = input.sheets.reduce((sum, s) => sum + s.catalogSumEur, 0);
    const summaryPage = pdfDoc.addPage([...A4_LANDSCAPE]);
    drawSummaryPage(summaryPage, fonts, input.tenantName, input.sheets, grandTotal);
  }

  return pdfDoc.save();
}

export function orderFormPdfFilename(sheets: OrderFormSheet[]): string {
  if (sheets.length === 1) {
    const d = formatOrderFormDate(sheets[0].orderDateIso).replace(/\./g, '-');
    const slug = sheets[0].employeeName.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    return `bestellformular-${d}-${slug}.pdf`;
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  return `bestellformular-sammel-${today}.pdf`;
}
