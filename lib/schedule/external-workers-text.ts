export type SubcontractorOption = { id: string; name: string };

function segmentMatchesPartner(segment: string, name: string): boolean {
  return segment === name || segment.startsWith(`${name} `) || segment.startsWith(`${name}+`);
}

/** Zerlegt gespeicherten Freitext in Stammlisten-Auswahl und Zusatz (z. B. „Firma +2“). */
export function parseExternalWorkersText(
  text: string | null | undefined,
  subcontractors: SubcontractorOption[],
): { selectedPartnerIds: string[]; extra: string } {
  const raw = text?.trim();
  if (!raw) return { selectedPartnerIds: [], extra: '' };

  const byName = [...subcontractors].sort((a, b) => b.name.length - a.name.length);
  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const selectedPartnerIds: string[] = [];
  const extraParts: string[] = [];

  for (const segment of segments) {
    const match = byName.find((p) => segmentMatchesPartner(segment, p.name));
    if (match) {
      if (!selectedPartnerIds.includes(match.id)) selectedPartnerIds.push(match.id);
      if (segment !== match.name) extraParts.push(segment);
    } else {
      extraParts.push(segment);
    }
  }

  return { selectedPartnerIds, extra: extraParts.join(', ') };
}

export function buildExternalWorkersText(
  selectedPartnerIds: string[],
  subcontractors: SubcontractorOption[],
  extra: string,
): string {
  const extraSegments = extra
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const usedExtra = new Set<number>();
  const parts: string[] = [];

  for (const id of selectedPartnerIds) {
    const name = subcontractors.find((p) => p.id === id)?.name;
    if (!name) continue;
    const idx = extraSegments.findIndex((seg, i) => !usedExtra.has(i) && segmentMatchesPartner(seg, name));
    if (idx >= 0) {
      parts.push(extraSegments[idx]!);
      usedExtra.add(idx);
    } else {
      parts.push(name);
    }
  }

  extraSegments.forEach((seg, i) => {
    if (!usedExtra.has(i)) parts.push(seg);
  });

  return parts.join(', ');
}
