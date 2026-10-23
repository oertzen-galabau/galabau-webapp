import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatSiteAddress } from '@/lib/sites/format-address';
import { sortedEntryTeamDisplay } from '@/lib/schedule/entry-member-labels';
import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import type { LeaveDay } from '@/lib/schedule/conflicts';
import { formatGermanWeekdayDate } from '@/lib/schedule/week';

const A4_LANDSCAPE = [841.89, 595.28] as const;
const MARGIN_X = 28;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 20;
/** Kopfzeile: Titel links, Mandanten-Logo rechts */
const HEADER_BAND_H = 68;
const LOGO_MAX_W = 108;
const LOGO_MAX_H = 54;
const GAP_HEADER_TABLE = 8;
/** Weniger Spalten pro Seite = breitere Zellen (Gerätenamen lesbar). */
const MAX_COLS = 5;
const BORDER = rgb(0.12, 0.12, 0.12);
const HEADER_GREEN = rgb(0.79, 0.9, 0.58);
const SUB_BOX_FILL = rgb(1, 0.99, 0.82);
const TEAM_BOX_FILL = rgb(1, 1, 1);
const EQUIP_BOX_FILL = rgb(0.97, 0.98, 1);
const LINE_H = 13;
const EQUIP_LINE_H = 14;
const SECTION_PAD = 8;
const SECTION_GAP = 4;
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

type EntryPdfSections = {
  team: ReturnType<typeof sortedEntryTeamDisplay>['members'];
  external: string[];
};

type EquipmentPdfLine = { text: string; size: number };

function entryPdfSections(entry: ScheduleEntryView): EntryPdfSections {
  const display = sortedEntryTeamDisplay(entry);
  return {
    team: display.members,
    external: display.external,
  };
}

function pushFittingChunks(text: string, font: PDFFont, size: number, maxWidth: number, lines: string[]) {
  let chunk = text;
  while (chunk.length > 0) {
    if (font.widthOfTextAtSize(chunk, size) <= maxWidth) {
      lines.push(chunk);
      return;
    }
    let cut = chunk.length;
    while (cut > 1 && font.widthOfTextAtSize(chunk.slice(0, cut), size) > maxWidth) {
      cut -= 1;
    }
    lines.push(chunk.slice(0, cut));
    chunk = chunk.slice(cut);
  }
}

function wrapTextLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      pushFittingChunks(current, font, size, maxWidth, lines);
      current = words[i]!;
    }
  }
  pushFittingChunks(current, font, size, maxWidth, lines);
  return lines;
}

function equipmentPdfLines(
  equipment: ScheduleEntryView['equipment'],
  font: PDFFont,
  colW: number,
): EquipmentPdfLine[] {
  const maxW = Math.max(12, colW - 8);
  const lines: EquipmentPdfLine[] = [];

  for (const eq of equipment) {
    const name = eq.name.trim();
    if (!name) continue;
    for (const part of wrapTextLines(name, font, FONT_MD, maxW)) {
      lines.push({ text: part, size: FONT_MD });
    }
    const inv = eq.inventory_number?.trim();
    if (inv) {
      lines.push({ text: inv, size: FONT_SM });
    } else if (eq.license_plate?.trim()) {
      lines.push({ text: eq.license_plate.trim(), size: FONT_SM });
    }
  }

  return lines;
}

function equipmentSectionHeight(
  equipment: ScheduleEntryView['equipment'],
  font: PDFFont,
  colW: number,
): number {
  const lineCount = Math.max(equipmentPdfLines(equipment, font, colW).length, 1);
  return SECTION_PAD * 2 + lineCount * EQUIP_LINE_H;
}

function teamSectionHeight(memberCount: number): number {
  const lines = Math.max(memberCount, 1);
  return SECTION_PAD * 2 + lines * LINE_H;
}

function subSectionHeight(externalCount: number): number {
  const lines = Math.max(externalCount, 1);
  return SECTION_PAD * 2 + lines * LINE_H;
}

/** Nur Hintergrund — Rahmen kommt vom äußeren Tabellenraster (kein Doppelrand). */
function drawSectionFill(
  page: PDFPage,
  cellX: number,
  colW: number,
  sectionTopY: number,
  sectionH: number,
  fill: ReturnType<typeof rgb>,
) {
  page.drawRectangle({
    x: cellX,
    y: sectionTopY - sectionH,
    width: colW,
    height: sectionH,
    color: fill,
  });
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const trimmed = text.trim();
  if (!trimmed || font.widthOfTextAtSize(trimmed, size) <= maxWidth) return trimmed;
  let out = trimmed;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  cellX: number,
  cellW: number,
  y: number,
  font: PDFFont,
  size: number,
  truncate = true,
) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const maxW = Math.max(8, cellW - 10);
  const line = truncate ? truncateToWidth(trimmed, font, size, maxW) : trimmed;
  const w = font.widthOfTextAtSize(line, size);
  page.drawText(line, { x: cellX + Math.max(2, (cellW - w) / 2), y, size, font });
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
  const bandTop = height - MARGIN_TOP;
  const bandBottom = bandTop - HEADER_BAND_H;

  let textY = bandTop - 17;
  page.drawText('Einsatztafel', { x: MARGIN_X, y: textY, size: 18, font: bold });
  textY -= 15;
  page.drawText(formatGermanWeekdayDate(day), { x: MARGIN_X, y: textY, size: 11, font: bold });

  if (draft) {
    textY -= 13;
    page.drawText('ENTWURF – noch nicht veröffentlicht', {
      x: MARGIN_X,
      y: textY,
      size: 9,
      font: bold,
      color: rgb(0.65, 0.2, 0.15),
    });
  }

  if (logoImage) {
    const scale = Math.min(LOGO_MAX_W / logoImage.width, LOGO_MAX_H / logoImage.height);
    const logoW = logoImage.width * scale;
    const logoH = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: width - MARGIN_X - logoW,
      y: bandBottom + (HEADER_BAND_H - logoH) / 2,
      width: logoW,
      height: logoH,
    });
  }

  return bandBottom - GAP_HEADER_TABLE;
}

function drawEinsatztafelTable(
  page: PDFPage,
  entries: ScheduleEntryView[],
  tableTopY: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width } = page.getSize();
  const tableWidth = width - MARGIN_X * 2;
  /** Immer 5 gleich breite Spalten pro Seite – auch wenn weniger als 5 Einsätze (Fortsetzungsseite). */
  const colW = tableWidth / MAX_COLS;
  const colXs = entries.map((_, i) => MARGIN_X + i * colW);

  const leaderH = 20;
  const siteH = 28;
  const addrH = 20;

  const sections = entries.map((entry) => entryPdfSections(entry));
  const teamBlockH = Math.max(...sections.map((s) => teamSectionHeight(s.team.length)), 44);
  const subBlockH = Math.max(...sections.map((s) => subSectionHeight(s.external.length)), 36);
  const equipBlockH = Math.max(
    ...entries.map((entry) => equipmentSectionHeight(entry.equipment, font, colW)),
    38,
  );

  const contentStackH = teamBlockH + SECTION_GAP + subBlockH + SECTION_GAP + equipBlockH;
  const totalH = leaderH + siteH + addrH + contentStackH;
  const tableBottomY = Math.max(tableTopY - totalH, MARGIN_BOTTOM);
  const contentTopY = tableTopY - leaderH - siteH - addrH;
  const teamSectionTopY = contentTopY;
  const subSectionTopY = contentTopY - teamBlockH - SECTION_GAP;
  const equipSectionTopY = subSectionTopY - subBlockH - SECTION_GAP;

  entries.forEach((entry, i) => {
    const cellX = colXs[i];
    const leaderY = tableTopY - leaderH + 6;
    drawCenteredText(page, entry.leaderLabel, cellX, colW, leaderY, bold, FONT_LG);

    page.drawRectangle({
      x: cellX,
      y: tableTopY - leaderH - siteH,
      width: colW,
      height: siteH,
      color: HEADER_GREEN,
    });
    const siteY = tableTopY - leaderH - siteH + 9;
    drawCenteredText(page, entry.site.name, cellX, colW, siteY, bold, FONT_LG);

    const addr = formatSiteAddress(entry.site);
    const addrY = tableTopY - leaderH - siteH - addrH + 6;
    if (addr) {
      drawCenteredText(page, addr, cellX, colW, addrY, font, FONT_SM);
    }

    const columnSections = sections[i];

    drawSectionFill(page, cellX, colW, teamSectionTopY, teamBlockH, TEAM_BOX_FILL);
    let teamY = teamSectionTopY - SECTION_PAD - 3;
    if (columnSections.team.length) {
      for (const line of columnSections.team) {
        drawCenteredText(page, line.text, cellX, colW, teamY, line.isForeman ? bold : font, FONT_MD);
        teamY -= LINE_H;
      }
    } else {
      drawCenteredText(page, '—', cellX, colW, teamY, font, FONT_MD);
    }

    drawSectionFill(page, cellX, colW, subSectionTopY, subBlockH, SUB_BOX_FILL);
    let subY = subSectionTopY - SECTION_PAD - 3;
    const externalLines = columnSections.external.length ? columnSections.external : ['—'];
    for (const external of externalLines) {
      drawCenteredText(page, external, cellX, colW, subY, font, FONT_MD);
      subY -= LINE_H;
    }

    drawSectionFill(page, cellX, colW, equipSectionTopY, equipBlockH, EQUIP_BOX_FILL);
    let equipY = equipSectionTopY - SECTION_PAD - 3;
    const equipmentLines = equipmentPdfLines(entry.equipment, font, colW);
    if (equipmentLines.length === 0) {
      drawCenteredText(page, '—', cellX, colW, equipY, font, FONT_MD);
    } else {
      for (const line of equipmentLines) {
        drawCenteredText(page, line.text, cellX, colW, equipY, font, line.size, false);
        equipY -= EQUIP_LINE_H;
      }
    }
  });

  const gridLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.6,
      color: BORDER,
    });
  };

  for (let i = 0; i <= MAX_COLS; i++) {
    const x = MARGIN_X + i * colW;
    gridLine(x, tableTopY, x, tableBottomY);
  }

  const rowTops = [
    tableTopY,
    tableTopY - leaderH,
    tableTopY - leaderH - siteH,
    contentTopY,
    tableBottomY,
  ];
  for (const rowY of rowTops) {
    gridLine(MARGIN_X, rowY, MARGIN_X + tableWidth, rowY);
  }
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
    page.drawText('Keine Einsätze an diesem Tag.', { x: MARGIN_X, y: tableTopY - 12, size: 11, font });
    return;
  }

  for (let offset = 0; offset < sorted.length; offset += MAX_COLS) {
    const chunk = sorted.slice(offset, offset + MAX_COLS);
    const page = pdfDoc.addPage([...A4_LANDSCAPE]);
    const tableTopY = drawPageHeader(page, day, draft, font, bold, logoImage);
    drawEinsatztafelTable(page, chunk, tableTopY, font, bold);
    if (sorted.length > MAX_COLS && offset + MAX_COLS < sorted.length) {
      page.drawText('Fortsetzung folgt', {
        x: MARGIN_X,
        y: MARGIN_BOTTOM - 4,
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
  let y = MARGIN_BOTTOM + 24;
  page.drawText('Abwesend (genehmigt):', { x: MARGIN_X, y, size: 9, font: bold });
  y -= 12;
  for (const row of dayAbsent.slice(0, 8)) {
    const name = employeeNames?.[row.userId] ?? row.userId.slice(0, 8);
    page.drawText(`· ${name} (${row.leaveType})`, { x: MARGIN_X + 6, y, size: 8, font });
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
    page.drawText('Keine Einsätze in dieser Woche.', { x: MARGIN_X, y: 400, size: 12, font });
  }

  return pdfDoc.save();
}
