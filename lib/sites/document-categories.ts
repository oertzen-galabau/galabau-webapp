export const SITE_DOCUMENT_CATEGORIES = [
  'plan',
  'leistungsverzeichnis',
  'fotos',
  'sonstiges',
] as const;

export type SiteDocumentCategory = (typeof SITE_DOCUMENT_CATEGORIES)[number];

export const DEFAULT_SITE_DOCUMENT_CATEGORY: SiteDocumentCategory = 'sonstiges';

export const SITE_DOCUMENT_CATEGORY_OPTIONS: {
  value: SiteDocumentCategory;
  label: string;
}[] = [
  { value: 'plan', label: 'Plan' },
  { value: 'leistungsverzeichnis', label: 'Leistungsverzeichnis' },
  { value: 'fotos', label: 'Fotos' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

export function isSiteDocumentCategory(value: string): value is SiteDocumentCategory {
  return (SITE_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export function parseSiteDocumentCategory(
  value: string | null | undefined,
): SiteDocumentCategory {
  if (value && isSiteDocumentCategory(value)) return value;
  return DEFAULT_SITE_DOCUMENT_CATEGORY;
}
