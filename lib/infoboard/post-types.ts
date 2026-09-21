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
