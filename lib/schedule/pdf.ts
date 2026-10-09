import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';
import { formatGermanWeekdayDate, weekDayLabels } from '@/lib/schedule/week';

const LANDSCAPE = [841.89, 595.28] as const;
const MARGIN = 36;

function memberNames(entry: ScheduleEntryView): string {
  const internal = entry.members.map((m) => `${m.first_name} ${m.last_name}`.trim()).join(', ');
  const external = entry.external_workers_text?.trim();
  if (internal && external) return `${internal}; ${external}`;
  return internal || external || '—';
}

export async function buildScheduleDayPdf(input: {
  tenantName: string;
  day: string;
  entries: ScheduleEntryView[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([...LANDSCAPE]);
  const { width, height } = page.getSize();

  const y = height - MARGIN;
  page.drawText('Einsatztafel', { x: MARGIN, y, size: 18, font: bold });
  page.drawText(input.tenantName, { x: MARGIN, y: y - 20, size: 10, font });
  page.drawText(formatGermanWeekdayDate(input.day), { x: MARGIN, y: y - 36, size: 11, font: bold });

  const sorted = [...input.entries].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.site.name.localeCompare(b.site.name));
  const cols = Math.max(sorted.length, 1);
  const colWidth = (width - MARGIN * 2) / cols;

  sorted.forEach((entry, index) => {
    const x = MARGIN + index * colWidth;
    let cy = y - 70;
    page.drawText(entry.leaderLabel, { x, y: cy, size: 12, font: bold, color: rgb(0.2, 0.2, 0.2) });
    cy -= 16;
    page.drawText(entry.site.name, { x, y: cy, size: 10, font: bold, maxWidth: colWidth - 8 });
    cy -= 14;
    page.drawText(`${entry.start_time}–${entry.end_time}`, { x, y: cy, size: 9, font });
    cy -= 14;
    const names = memberNames(entry);
    const lines = names.match(/.{1,28}(\s|$)/g) ?? [names];
    for (const line of lines.slice(0, 8)) {
      page.drawText(line.trim(), { x, y: cy, size: 9, font, maxWidth: colWidth - 8 });
      cy -= 12;
    }
    if (entry.equipmentLabel) {
      cy -= 2;
      page.drawText(entry.equipmentLabel.slice(0, 80), { x, y: cy, size: 8, font, maxWidth: colWidth - 8 });
      cy -= 12;
    }
    if (entry.notes) {
      cy -= 4;
      page.drawText(entry.notes.slice(0, 80), { x, y: cy, size: 8, font, maxWidth: colWidth - 8 });
    }
  });

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
  const page = pdfDoc.addPage([...LANDSCAPE]);
  const { width, height } = page.getSize();

  const labels = weekDayLabels();
  const dayCount = Math.max(input.weekDays.length, 1);
  const colWidth = (width - MARGIN * 2) / dayCount;
  let y = height - MARGIN;

  page.drawText('Wochenplan', { x: MARGIN, y, size: 18, font: bold });
  page.drawText(`${input.tenantName} · KW ab ${input.weekStart}`, { x: MARGIN, y: y - 18, size: 10, font });

  y -= 48;
  input.weekDays.forEach((day, i) => {
    const x = MARGIN + i * colWidth;
    page.drawText(labels[i], { x, y, size: 10, font: bold });
    page.drawText(day.slice(8, 10) + '.' + day.slice(5, 7), { x, y: y - 12, size: 9, font });
  });

  const rowHeight = 58;
  let row = 0;
  for (const entry of input.entries) {
    const startIdx = input.weekDays.indexOf(entry.start_date);
    const endIdx = input.weekDays.indexOf(entry.end_date);
    const from = startIdx >= 0 ? startIdx : 0;
    const to = endIdx >= 0 ? endIdx : from;
    const span = Math.max(to - from + 1, 1);
    const x = MARGIN + from * colWidth + 2;
    const w = span * colWidth - 4;
    const ry = y - 28 - row * rowHeight;
    const boxHeight = entry.equipmentLabel ? 46 : 40;
    page.drawRectangle({ x, y: ry - boxHeight + 4, width: w, height: boxHeight, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 1 });
    page.drawText(`${entry.leaderLabel} · ${entry.site.name}`.slice(0, 48), {
      x: x + 4,
      y: ry - 14,
      size: 8,
      font: bold,
      maxWidth: w - 8,
    });
    page.drawText(`${entry.start_time}–${entry.end_time}`, { x: x + 4, y: ry - 26, size: 7, font });
    let textY = ry - 36;
    page.drawText(memberNames(entry).slice(0, 60), { x: x + 4, y: textY, size: 7, font, maxWidth: w - 8 });
    if (entry.equipmentLabel) {
      textY -= 10;
      page.drawText(entry.equipmentLabel.slice(0, 60), { x: x + 4, y: textY, size: 6, font, maxWidth: w - 8 });
    }
    row += 1;
    if (ry - 60 < MARGIN) break;
  }

  return pdfDoc.save();
}
