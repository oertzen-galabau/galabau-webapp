import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatSiteAddress } from '@/lib/sites/format-address';
import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import type { LeaveDay } from '@/lib/schedule/conflicts';
import { formatGermanWeekdayDate, weekDayLabels } from '@/lib/schedule/week';

const A4 = [595.28, 841.89] as const;
const MARGIN = 48;
const LINE = 14;

function memberNames(entry: ScheduleEntryView): string {
  const internal = entry.members.map((m) => `${m.first_name} ${m.last_name}`.trim()).join(', ');
  const external = entry.external_workers_text?.trim();
  if (internal && external) return `${internal}; ${external}`;
  return internal || external || '—';
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  if (!words.length || words[0] === '') return ['—'];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['—'];
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineHeight = LINE,
): number {
  const lines = wrapText(text, font, size, maxWidth);
  let cy = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cy, size, font, maxWidth });
    cy -= lineHeight;
  }
  return cy;
}

export async function buildScheduleDayPdf(input: {
  tenantName: string;
  day: string;
  entries: ScheduleEntryView[];
  draft?: boolean;
  absentees?: LeaveDay[];
  employeeNames?: Record<string, string>;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([...A4]);
  let { width, height } = page.getSize();
  let y = height - MARGIN;

  page.drawText('Tageseinsatzplan', { x: MARGIN, y, size: 16, font: bold });
  y -= 18;
  page.drawText(input.tenantName, { x: MARGIN, y, size: 10, font });
  y -= 16;
  page.drawText(formatGermanWeekdayDate(input.day), { x: MARGIN, y, size: 11, font: bold });
  y -= 20;

  if (input.draft) {
    page.drawText('ENTWURF – noch nicht veröffentlicht', {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: rgb(0.65, 0.2, 0.15),
    });
    y -= 18;
  }

  const sorted = [...input.entries].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.site.name.localeCompare(b.site.name, 'de'),
  );
  const contentWidth = width - MARGIN * 2;

  const ensureSpace = (needed: number) => {
    if (y - needed >= MARGIN) return;
    page = pdfDoc.addPage([...A4]);
    ({ width, height } = page.getSize());
    y = height - MARGIN;
  };

  if (!sorted.length) {
    page.drawText('Keine Einsätze an diesem Tag.', { x: MARGIN, y, size: 10, font });
  }

  for (const entry of sorted) {
    const address = formatSiteAddress(entry.site);
    const blockEstimate = 90;
    ensureSpace(blockEstimate);

    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: width - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 8;

    page.drawText(`${entry.leaderLabel} · ${entry.site.name}`, {
      x: MARGIN,
      y,
      size: 11,
      font: bold,
      maxWidth: contentWidth,
    });
    y -= LINE;

    if (address) {
      y = drawWrapped(page, address, MARGIN, y, font, 9, contentWidth) - 2;
    }

    page.drawText(`Zeit: ${entry.start_time}–${entry.end_time}`, { x: MARGIN, y, size: 9, font });
    y -= LINE;

    y = drawWrapped(page, `Team: ${memberNames(entry)}`, MARGIN, y, font, 9, contentWidth) - 2;

    if (entry.equipmentLabel) {
      y = drawWrapped(page, `Fahrzeuge/Geräte: ${entry.equipmentLabel}`, MARGIN, y, font, 9, contentWidth) - 2;
    }

    if (entry.notes?.trim()) {
      y = drawWrapped(page, `Hinweis: ${entry.notes.trim()}`, MARGIN, y, font, 9, contentWidth) - 2;
    }

    y -= 10;
  }

  const dayAbsent = (input.absentees ?? []).filter((a) => a.date === input.day);
  if (dayAbsent.length) {
    ensureSpace(40 + dayAbsent.length * LINE);
    y -= 6;
    page.drawText('Abwesend (genehmigt)', { x: MARGIN, y, size: 10, font: bold });
    y -= LINE;
    for (const row of dayAbsent) {
      const name = input.employeeNames?.[row.userId] ?? row.userId.slice(0, 8);
      page.drawText(`· ${name} (${row.leaveType})`, { x: MARGIN + 8, y, size: 9, font });
      y -= LINE;
    }
  }

  return pdfDoc.save();
}

export async function buildScheduleWeekPdf(input: {
  tenantName: string;
  weekStart: string;
  weekDays: string[];
  entries: ScheduleEntryView[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  const labels = weekDayLabels();
  const dayCount = Math.max(input.weekDays.length, 1);
  const colWidth = (width - MARGIN * 2) / dayCount;
  let y = height - MARGIN;

  page.drawText('Wochenübersicht', { x: MARGIN, y, size: 18, font: bold });
  page.drawText(`${input.tenantName} · KW ab ${input.weekStart}`, { x: MARGIN, y: y - 18, size: 10, font });

  y -= 44;
  input.weekDays.forEach((day, i) => {
    const x = MARGIN + i * colWidth;
    page.drawText(labels[i], { x, y, size: 10, font: bold });
    page.drawText(`${day.slice(8, 10)}.${day.slice(5, 7)}`, { x, y: y - 12, size: 9, font });
  });

  const siteIds = [...new Set(input.entries.map((e) => e.site_id))];
  const sites = siteIds
    .map((id) => input.entries.find((e) => e.site_id === id)?.site)
    .filter(Boolean) as ScheduleEntryView['site'][];
  sites.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const bySiteDay = new Map<string, ScheduleEntryView[]>();
  for (const entry of input.entries) {
    const key = `${entry.site_id}:${entry.start_date}`;
    const list = bySiteDay.get(key) ?? [];
    list.push(entry);
    bySiteDay.set(key, list);
  }

  let rowY = y - 28;
  const rowHeight = 52;
  for (const site of sites) {
    if (rowY - rowHeight < MARGIN) break;
    page.drawText(site.name.slice(0, 36), { x: MARGIN - 2, y: rowY - 12, size: 8, font: bold, maxWidth: 80 });
    input.weekDays.forEach((day, i) => {
      const x = MARGIN + i * colWidth + 2;
      const cellEntries = bySiteDay.get(`${site.id}:${day}`) ?? [];
      if (!cellEntries.length) return;
      const cellH = 44;
      page.drawRectangle({
        x,
        y: rowY - cellH + 4,
        width: colWidth - 4,
        height: cellH,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      });
      const e = cellEntries[0];
      page.drawText(`${e.leaderLabel}`, { x: x + 4, y: rowY - 12, size: 7, font: bold });
      page.drawText(memberNames(e).slice(0, 72), {
        x: x + 4,
        y: rowY - 24,
        size: 6,
        font,
        maxWidth: colWidth - 10,
      });
      page.drawText(`${e.start_time}–${e.end_time}`, { x: x + 4, y: rowY - 34, size: 6, font });
    });
    rowY -= rowHeight;
  }

  return pdfDoc.save();
}
