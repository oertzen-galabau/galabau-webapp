type RawContactLink = {
  partner_contact_id: string;
  contact:
    | {
        id: string;
        name: string;
        role_title: string | null;
        phone: string | null;
        email: string | null;
      }
    | {
        id: string;
        name: string;
        role_title: string | null;
        phone: string | null;
        email: string | null;
      }[]
    | null;
};

type RawSiteSupplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  partner_id: string | null;
  partner_location_id: string | null;
  location:
    | {
        id: string;
        label: string;
        street: string | null;
        postal_code: string | null;
        city: string | null;
        phone: string | null;
      }
    | {
        id: string;
        label: string;
        street: string | null;
        postal_code: string | null;
        city: string | null;
        phone: string | null;
      }[]
    | null;
  contact_links: RawContactLink[] | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function mapSiteSuppliers(rows: RawSiteSupplier[] | null | undefined) {
  return (rows ?? []).map((row) => {
    const linkedContacts = (row.contact_links ?? [])
      .map((link) => unwrapOne(link.contact))
      .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));

    return {
      id: row.id,
      name: row.name,
      contact_person: row.contact_person,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      partner_id: row.partner_id,
      partner_location_id: row.partner_location_id,
      location: unwrapOne(row.location),
      linkedContacts,
    };
  });
}
