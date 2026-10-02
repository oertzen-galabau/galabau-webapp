/** Normalisiert Preisstrings (DE/EN, Währungszeichen) zu Euro-Betrag. */
export function normalizePriceString(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  s = s.replace(/\s/g, '').replace(/[$€]|EUR|eur|USD|usd/gi, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }

  const num = Number.parseFloat(s);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}
