export const INFOBOARD_POST_TYPES = ['news', 'termin', 'hinweis'] as const;

export type InfoboardPostType = (typeof INFOBOARD_POST_TYPES)[number];

export const INFOBOARD_POST_TYPE_LABELS: Record<InfoboardPostType, string> = {
  news: 'Neuigkeit',
  termin: 'Termin',
  hinweis: 'Hinweis',
};

export const INFOBOARD_POST_TYPE_BADGE_CLASS: Record<InfoboardPostType, string> = {
  news: 'planned',
  termin: 'active',
  hinweis: 'travel',
};

export function isInfoboardPostType(value: string): value is InfoboardPostType {
  return (INFOBOARD_POST_TYPES as readonly string[]).includes(value);
}

export function infoboardPostTypeLabel(value: string): string {
  if (isInfoboardPostType(value)) return INFOBOARD_POST_TYPE_LABELS[value];
  return value;
}

export function infoboardPostTypeBadgeClass(value: string): string {
  if (isInfoboardPostType(value)) return INFOBOARD_POST_TYPE_BADGE_CLASS[value];
  return 'planned';
}

/** Wichtig-Haken gesetzt und Ablaufdatum leer oder noch nicht erreicht. */
export function isInfoboardPostImportantActive(
  isImportant: boolean,
  importantUntil: string | null,
  now: Date = new Date(),
): boolean {
  if (!isImportant) return false;
  if (!importantUntil) return true;
  return new Date(importantUntil).getTime() > now.getTime();
}

export function compareInfoboardPostsForList(
  a: { isImportant: boolean; importantUntil: string | null; publishedAt: string | null },
  b: { isImportant: boolean; importantUntil: string | null; publishedAt: string | null },
  now: Date = new Date(),
): number {
  const aActive = isInfoboardPostImportantActive(a.isImportant, a.importantUntil, now);
  const bActive = isInfoboardPostImportantActive(b.isImportant, b.importantUntil, now);
  if (aActive !== bActive) return aActive ? -1 : 1;
  const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
  const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
  return bTime - aTime;
}
