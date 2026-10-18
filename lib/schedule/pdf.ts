import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from 'pdf-lib';
import { equipmentScheduleLabel } from '@/lib/equipment/labels';
import { formatSiteAddress } from '@/lib/sites/format-address';
import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import type { LeaveDay } from '@/lib/schedule/conflicts';
import { formatGermanWeekdayDate } from '@/lib/schedule/week';

const A4_LANDSCAPE = [841.89, 595.28] as const;
const MARGIN = 36;
const MAX_COLS = 7;
const BORDER = rgb(0.12, 0.12, 0.12);
const HEADER_GREEN = rgb(0.79, 0.9, 0.58);
const HIGHLIGHT_YELLOW = rgb(1, 0.98, 0.55);
const LINE_H = 11;
const FONT_SM = 8;
const FONT_MD = 9;
const FONT_LG = 10;

export type TenantLogoBytes = {
  bytes: Uint8Array;
  contentType: string;
};

export async function loadTenantLogoBytes(logoUrl: string | null | undefined): Promise<TenantLogoBytes | null> {
  if (!logoUrl?.trim()) return null;
  try {
    const res = await fetch(logoUrl, { cache: 'force-cache' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/png';
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}

function sortEntries(entries: ScheduleEntryView[]): ScheduleEntryView[] {
  return [...entries].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.site.name.localeCompare(b.site.name, 'de'),
  );
}

function memberPdfName(m: ScheduleEntryView['members'][number]): string {
  const last = m.last_name?.trim() ?? '';
  const first = m.first_name?.trim() ?? '';
  if (last && first) return `${last}, ${first}`;
  return `${last}${first}`.trim() || '—';
}

function equipmentBottomLabel(entry: ScheduleEntryView): string {
  if (!entry.equipment.length) return '';
  return entry.equipment
    .map((eq) => eq.license_plate?.trim() || eq.inventory_number?.trim() || equipmentScheduleLabel(eq))
    .join(', ');
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  cellX: number,
  cellW: number,
  y: number,
  font: PDFFont,
  size: number,
) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const w = font.widthOfTextAtSize(trimmed, size);
  page.drawText(trimmed, { x: cellX + Math.max(2, (cellW - w) / 2), y, size, font });
}

function drawYellowTag(
  page: PDFPage,
  text: string,
  cellX: number,
  cellW: number,
  y: number,
  font: PDFFont,
) {
  const trimmed = text.trim();
  if (!trimmed) return y;
  const size = FONT_MD;
  const tw = font.widthOfTextAtSize(trimmed, size);
  const boxW = Math.min(cellW - 10, tw + 10);
  const boxH = 14;
  const boxX = cellX + (cellW - boxW) / 2;
  page.drawRectangle({
    x: boxX,
    y: y - 2,
    width: boxW,
    height: boxH,
    color: HIGHLIGHT_YELLOW,
    borderColor: BORDER,
    borderWidth: 0.4,
  });
  page.drawText(trimmed, { x: boxX + (boxW - tw) / 2, y: y + 2, size, font });
  return y - boxH - 4;
}

async function embedTenantLogo(
  pdfDoc: PDFDocument,
  logo?: TenantLogoBytes | null,
): Promise<PDFImage | null> {
  if (!logo?.bytes?.length) return null;
  const ct = logo.contentType.toLowerCase();
  try {
    if (ct.includes('png')) return await pdfDoc.embedPng(logo.bytes);
    if (ct.includes('jpeg') || ct.includes('jpg')) return await pdfDoc.embedJpg(logo.bytes);
  } catch {
    return null;
  }
  return null;
}

function drawPageHeader(
  page: PDFPage,
  day: string,
  draft: boolean,
  font: PDFFont,
  bold: PDFFont,
  logoImage: PDFImage | null,
) {
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  page.drawText('Einsatztafel', { x: MARGIN, y, size: 20, font: bold });
  y -= 22;
  page.drawText(formatGermanWeekdayDate(day), { x: MARGIN, y, size: 12, font: bold });
  y -= 16;

  if (draft) {
    page.drawText('ENTWURF – noch nicht veröffentlicht', {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: rgb(0.65, 0.2, 0.15),
    });
    y -= 14;
  }

  if (logoImage) {
    const maxW = 72;
    const scale = maxW / logoImage.width;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: width - MARGIN - maxW,
      y: height - MARGIN - h + 4,
      width: maxW,
      height: h,
    });
  }

  return y - 8;
}

function drawEinsatztafelTable(
  page: PDFPage,
  entries: ScheduleEntryView[],
  tableTopY: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width } = page.getSize();
  const tableWidth = width - MARGIN * 2;
  const colW = tableWidth / entries.length;
  const colXs = entries.map((_, i) => MARGIN + i * colW);

  const leaderH = 16;
  const siteH = 22;
  const addrH = 16;

  const teamHeights = entries.map((entry) => {
    const memberLines = entry.members.length ? entry.members.map(memberPdfName) : [];
    const external = entry.external_workers_text?.trim();
    let h = 8 + Math.max(memberLines.length, external && !memberLines.length ? 1 : 0) * LINE_H;
    if (external) h += 22;
    return Math.max(h, 36);
  });
  const teamH = Math.max(...teamHeights, 40);
  const equipH = 18;

  const totalH = leaderH + siteH + addrH + teamH + equipH;
  const tableBottomY = tableTopY - totalH;

  for (let i = 0; i <= entries.length; i++) {
    const x = MARGIN + i * colW;
    page.drawLine({
      start: { x, y: tableTopY },
      end: { x, y: tableBottomY },
      thickness: 0.8,
      color: BORDER,
    });
  }

  const rowTops = [
    tableTopY,
    tableTopY - leaderH,
    tableTopY - leaderH - siteH,
    tableTopY - leaderH - siteH - addrH,
    tableTopY - leaderH - siteH - addrH - teamH,
    tableBottomY,
  ];
  for (const rowY of rowTops) {
    page.drawLine({
      start: { x: MARGIN, y: rowY },
      end: { x: MARGIN + tableWidth, y: rowY },
      thickness: 0.8,
      color: BORDER,
    });
  }

  entries.forEach((entry, i) => {
    const cellX = colXs[i];
    const leaderY = tableTopY - leaderH + 5;
    drawCenteredText(page, entry.leaderLabel, cellX, colW, leaderY, bold, FONT_LG);

    page.drawRectangle({
      x: cellX + 0.4,
      y: tableTopY - leaderH - siteH + 0.4,
      width: colW - 0.8,
      height: siteH - 0.8,
      color: HEADER_GREEN,
    });
    const siteY = tableTopY - leaderH - siteH + 7;
    drawCenteredText(page, entry.site.name, cellX, colW, siteY, bold, FONT_LG);

    const addr = formatSiteAddress(entry.site);
    const addrY = tableTopY - leaderH - siteH - addrH + 5;
    if (addr) {
      drawCenteredText(page, addr, cellX, colW, addrY, font, FONT_SM);
    }

    let teamY = tableTopY - leaderH - siteH - addrH - 10;
    for (const name of entry.members.map(memberPdfName)) {
      drawCenteredText(page, name, cellX, colW, teamY, font, FONT_MD);
      teamY -= LINE_H;
    }
    const external = entry.external_workers_text?.trim();
    if (external) {
      if (!entry.members.length) teamY -= 2;
      drawYellowTag(page, external, cellX, colW, teamY, font);
    }

    const equip = equipmentBottomLabel(entry);
    const equipY = tableBottomY + 5;
    if (equip) {
      drawCenteredText(page, equip, cellX, colW, equipY, font, FONT_MD);
    }
  });
}

async function buildEinsatztafelPdfPages(
  pdfDoc: PDFDocument,
  day: string,
  entries: ScheduleEntryView[],
  options: { draft?: boolean; logo?: TenantLogoBytes | null },
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await embedTenantLogo(pdfDoc, options.logo);
  const sorted = sortEntries(entries);
  const draft = options.draft ?? false;

  if (!sorted.length) {
    const page = pdfDoc.addPage([...A4_LANDSCAPE]);
    const tableTopY = drawPageHeader(page, day, draft, font, bold, logoImage);
    page.drawText('Keine Einsätze an diesem Tag.', { x: MARGIN, y: tableTopY - 12, size: 11, font });
    return;
  }

  for (let offset = 0; offset < sorted.length; offset += MAX_COLS) {
    const chunk = sorted.slice(offset, offset + MAX_COLS);
    const page = pdfDoc.addPage([...A4_LANDSCAPE]);
    const tableTopY = drawPageHeader(page, day, draft, font, bold, logoImage);
    drawEinsatztafelTable(page, chunk, tableTopY, font, bold);
    if (sorted.length > MAX_COLS && offset + MAX_COLS < sorted.length) {
      page.drawText('Fortsetzung folgt', {
        x: MARGIN,
        y: MARGIN - 4,
        size: 8,
        font,
        color: rgb(0.45, 0.45, 0.45),
      });
    }
  }
}

function drawAbsenteesFooter(
  page: PDFPage,
  day: string,
  absentees: LeaveDay[],
  employeeNames: Record<string, string> | undefined,
  font: PDFFont,
  bold: PDFFont,
) {
  const dayAbsent = absentees.filter((a) => a.date === day);
  if (!dayAbsent.length) return;
  let y = MARGIN + 24;
  page.drawText('Abwesend (genehmigt):', { x: MARGIN, y, size: 9, font: bold });
  y -= 12;
  for (const row of dayAbsent.slice(0, 8)) {
    const name = employeeNames?.[row.userId] ?? row.userId.slice(0, 8);
    page.drawText(`· ${name} (${row.leaveType})`, { x: MARGIN + 6, y, size: 8, font });
    y -= 10;
  }
}

export async function buildScheduleDayPdf(input: {
  tenantName: string;
  day: string;
  entries: ScheduleEntryView[];
  draft?: boolean;
  absentees?: LeaveDay[];
  employeeNames?: Record<string, string>;
  logo?: TenantLogoBytes | null;
}): Promise<Uint8Array> {
  void input.tenantName;
  const pdfDoc = await PDFDocument.create();
  await buildEinsatztafelPdfPages(pdfDoc, input.day, input.entries, {
    draft: input.draft,
    logo: input.logo,
  });

  if (input.absentees?.length) {
    const pages = pdfDoc.getPages();
    const last = pages[pages.length - 1];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    drawAbsenteesFooter(last, input.day, input.absentees, input.employeeNames, font, bold);
  }

  return pdfDoc.save();
}

export async function buildScheduleWeekPdf(input: {
  tenantName: string;
  weekStart: string;
  weekDays: string[];
  entries: ScheduleEntryView[];
  logo?: TenantLogoBytes | null;
}): Promise<Uint8Array> {
  void input.tenantName;
  void input.weekStart;
  const pdfDoc = await PDFDocument.create();

  for (const day of input.weekDays) {
    const dayEntries = input.entries.filter((e) => e.start_date === day);
    await buildEinsatztafelPdfPages(pdfDoc, day, dayEntries, { logo: input.logo });
  }

  if (!pdfDoc.getPageCount()) {
    const page = pdfDoc.addPage([...A4_LANDSCAPE]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText('Keine Einsätze in dieser Woche.', { x: MARGIN, y: 400, size: 12, font });
  }

  return pdfDoc.save();
}
