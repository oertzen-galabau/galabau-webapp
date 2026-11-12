const MAX_INTERNAL_NOTE_LENGTH = 8000;

export function formatInternalNoteTimestamp(date = new Date()): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Eine Log-Zeile inkl. Zeitstempel-Präfix. */
export function formatInternalNoteEntry(text: string, date = new Date()): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Notiz fehlt');
  }
  return `[${formatInternalNoteTimestamp(date)}] ${trimmed}`;
}

export function appendInternalNote(existing: string | null | undefined, newEntryText: string): string {
  const line = formatInternalNoteEntry(newEntryText);
  const next = existing?.trim() ? `${existing.trimEnd()}\n${line}` : line;
  if (next.length > MAX_INTERNAL_NOTE_LENGTH) {
    throw new Error(`Interne Notizen dürfen maximal ${MAX_INTERNAL_NOTE_LENGTH} Zeichen haben`);
  }
  return next;
}

export function displayInternalNoteLog(raw: string | null | undefined): string {
  return raw?.trim() ?? '';
}
