import { dateInRange, formatGermanDate, formatGermanWeekdayDate } from '@/lib/schedule/week';

const LEGEND_DATE: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

function formatLegendDate(iso: string): string {
  return formatGermanDate(iso, LEGEND_DATE);
}

export type TenantClosureItem = {
  id: string;
  title: string;
  kind: 'company' | 'bridge';
  start_date: string;
  end_date: string;
};

export type TenantClosureBarLayout = {
  item: TenantClosureItem;
  colStart: number;
  colSpan: number;
  row: number;
};

export type TenantDayClosure = 'company' | 'bridge';

function clipToVisibleRange(
  startDate: string,
  endDate: string,
  days: string[],
): { start: string; end: string } | null {
  if (days.length === 0) return null;
  const rangeStart = days[0]!;
  const rangeEnd = days[days.length - 1]!;
  const start = startDate < rangeStart ? rangeStart : startDate;
  const end = endDate > rangeEnd ? rangeEnd : endDate;
  if (start > end) return null;
  return { start, end };
}

export function tenantClosureItems(
  companyHolidays: { id: string; title: string; start_date: string; end_date: string }[],
  bridgeDays: { id: string; title: string; date: string }[],
): TenantClosureItem[] {
  const items: TenantClosureItem[] = [
    ...companyHolidays.map((h) => ({
      id: h.id,
      title: h.title,
      kind: 'company' as const,
      start_date: h.start_date,
      end_date: h.end_date,
    })),
    ...bridgeDays.map((b) => ({
      id: b.id,
      title: b.title,
      kind: 'bridge' as const,
      start_date: b.date,
      end_date: b.date,
    })),
  ];
  return items.sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      a.end_date.localeCompare(b.end_date) ||
      a.title.localeCompare(b.title),
  );
}

export function layoutTenantClosureBars(
  items: TenantClosureItem[],
  days: string[],
): TenantClosureBarLayout[] {
  const occupied: boolean[][] = [];
  const result: TenantClosureBarLayout[] = [];

  for (const item of items) {
    const clipped = clipToVisibleRange(item.start_date, item.end_date, days);
    if (!clipped) continue;

    let colStart = -1;
    let colEnd = -1;
    days.forEach((day, idx) => {
      if (dateInRange(day, clipped.start, clipped.end)) {
        if (colStart < 0) colStart = idx;
        colEnd = idx;
      }
    });
    if (colStart < 0 || colEnd < colStart) continue;
    const colSpan = colEnd - colStart + 1;

    let row = 0;
    while (true) {
      if (!occupied[row]) occupied[row] = Array(days.length).fill(false);
      let fits = true;
      for (let c = colStart; c <= colEnd; c++) {
        if (occupied[row]![c]) {
          fits = false;
          break;
        }
      }
      if (fits) {
        for (let c = colStart; c <= colEnd; c++) occupied[row]![c] = true;
        result.push({ item, colStart, colSpan, row });
        break;
      }
      row += 1;
    }
  }

  return result;
}

export function tenantClosureForDay(
  day: string,
  companyHolidays: { start_date: string; end_date: string }[],
  bridgeDays: { date: string }[],
): TenantDayClosure | null {
  if (bridgeDays.some((b) => b.date === day)) return 'bridge';
  if (companyHolidays.some((h) => dateInRange(day, h.start_date, h.end_date))) return 'company';
  return null;
}

export function tenantClosureTitlesForDay(
  day: string,
  companyHolidays: { title: string; start_date: string; end_date: string }[],
  bridgeDays: { title: string; date: string }[],
): string | null {
  const titles: string[] = [];
  for (const h of companyHolidays) {
    if (dateInRange(day, h.start_date, h.end_date)) titles.push(h.title);
  }
  for (const b of bridgeDays) {
    if (b.date === day) titles.push(b.title);
  }
  if (titles.length === 0) return null;
  return titles.join(' · ');
}

const CLOSURE_KIND_LABEL: Record<TenantDayClosure, string> = {
  company: 'Betriebsferien',
  bridge: 'Brückentag',
};

export type TenantClosurePin = {
  day: string;
  kind: TenantDayClosure;
  kindLabel: string;
  titles: string;
  dateLabel: string;
  dateLabelLong: string;
};

export function tenantClosurePinForDay(
  day: string,
  companyHolidays: { title: string; start_date: string; end_date: string }[],
  bridgeDays: { title: string; date: string }[],
): TenantClosurePin | null {
  const kind = tenantClosureForDay(day, companyHolidays, bridgeDays);
  const titles = tenantClosureTitlesForDay(day, companyHolidays, bridgeDays);
  if (!kind || !titles) return null;
  return {
    day,
    kind,
    kindLabel: CLOSURE_KIND_LABEL[kind],
    titles,
    dateLabel: formatGermanDate(day, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    dateLabelLong: formatGermanWeekdayDate(day),
  };
}

/** Sichtbarer Bereich der Timeline (ohne Sidebar) → relevanter Tag mit Betriebs-/Brückentag. */
export function pickTenantClosureDayInViewport(input: {
  scrollLeft: number;
  scrollClientWidth: number;
  sidebarWidthPx: number;
  colWidthPx: number;
  days: string[];
  companyHolidays: { start_date: string; end_date: string }[];
  bridgeDays: { date: string }[];
}): string | null {
  const {
    scrollLeft,
    scrollClientWidth,
    sidebarWidthPx,
    colWidthPx,
    days,
    companyHolidays,
    bridgeDays,
  } = input;
  if (days.length === 0 || colWidthPx <= 0) return null;

  const timelineWidth = Math.max(0, scrollClientWidth - sidebarWidthPx);
  if (timelineWidth <= 0) return null;

  const firstCol = Math.max(0, Math.floor(scrollLeft / colWidthPx));
  const lastCol = Math.min(
    days.length - 1,
    Math.max(firstCol, Math.ceil((scrollLeft + timelineWidth) / colWidthPx) - 1),
  );
  const centerCol = Math.min(
    days.length - 1,
    Math.max(0, Math.floor((scrollLeft + timelineWidth / 2) / colWidthPx)),
  );

  const hasClosure = (day: string) =>
    tenantClosureForDay(day, companyHolidays, bridgeDays) !== null;

  const centerDay = days[centerCol];
  if (centerDay && hasClosure(centerDay)) return centerDay;

  for (let i = firstCol; i <= lastCol; i += 1) {
    const day = days[i];
    if (day && hasClosure(day)) return day;
  }
  return null;
}

export type TenantClosureLegendEntry = {
  id: string;
  kind: 'company' | 'bridge';
  title: string;
  rangeLabel: string;
};

export function tenantClosureLegendEntries(
  days: string[],
  companyHolidays: { id: string; title: string; start_date: string; end_date: string }[],
  bridgeDays: { id: string; title: string; date: string }[],
): TenantClosureLegendEntry[] {
  if (days.length === 0) return [];
  const rangeStart = days[0]!;
  const rangeEnd = days[days.length - 1]!;
  const out: TenantClosureLegendEntry[] = [];

  for (const h of companyHolidays) {
    const start = h.start_date < rangeStart ? rangeStart : h.start_date;
    const end = h.end_date > rangeEnd ? rangeEnd : h.end_date;
    if (start > end) continue;
    out.push({
      id: h.id,
      kind: 'company',
      title: h.title,
      rangeLabel:
        start === end
          ? formatLegendDate(start)
          : `${formatLegendDate(start)} – ${formatLegendDate(end)}`,
    });
  }
  for (const b of bridgeDays) {
    if (b.date < rangeStart || b.date > rangeEnd) continue;
    out.push({
      id: b.id,
      kind: 'bridge',
      title: b.title,
      rangeLabel: formatLegendDate(b.date),
    });
  }

  return out.sort((a, b) => a.rangeLabel.localeCompare(b.rangeLabel, 'de'));
}

/** Kurztext in der Tages-Spalte (erstes Wort des Titels). */
export function tenantClosureDayAbbrev(title: string, maxLen = 5): string {
  const part = (title.split(/[\s/–-]/)[0] ?? title).trim();
  if (part.length <= maxLen) return part;
  return `${part.slice(0, Math.max(1, maxLen - 1))}…`;
}

export function tenantClosureDayHeadLabel(
  day: string,
  companyHolidays: { title: string; start_date: string; end_date: string }[],
  bridgeDays: { title: string; date: string }[],
  maxLen = 5,
): string | null {
  const full = tenantClosureTitlesForDay(day, companyHolidays, bridgeDays);
  if (!full) return null;
  return tenantClosureDayAbbrev(full.split(' · ')[0]!, maxLen);
}
