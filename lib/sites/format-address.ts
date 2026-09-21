export type SiteAddressParts = {
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
  address?: string | null;
};

export function formatSiteAddress(site: SiteAddressParts): string | null {
  const street = site.street?.trim();
  const zipCode = site.zip_code?.trim();
  const city = site.city?.trim();
  const parts: string[] = [];

  if (street) parts.push(street);

  const cityLine = [zipCode, city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);

  if (parts.length > 0) return parts.join(', ');

  const legacy = site.address?.trim();
  return legacy || null;
}

export function hasSiteAddress(site: SiteAddressParts): boolean {
  return formatSiteAddress(site) !== null;
}

export function readSiteAddressFromForm(formData: FormData) {
  const street = (formData.get('street') as string)?.trim() || null;
  const zip_code = (formData.get('zip_code') as string)?.trim() || null;
  const city = (formData.get('city') as string)?.trim() || null;
  const address = formatSiteAddress({ street, zip_code, city });

  return { street, zip_code, city, address };
}
