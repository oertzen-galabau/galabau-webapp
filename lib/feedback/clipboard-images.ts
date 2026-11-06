/** Bilddateien aus der Zwischenablage (Screenshot, Kopie aus Browser/Finder). */
export function collectImagesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];

  const out: File[] = [];
  const seen = new Set<string>();

  function push(raw: File | null) {
    if (!raw || raw.size === 0) return;
    const file = normalizeClipboardImageFile(raw);
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  }

  if (data.files?.length) {
    for (const file of data.files) {
      if (file.type.startsWith('image/') || file.type === '') push(file);
    }
  }

  for (const item of data.items ?? []) {
    if (item.kind === 'file' || item.type.startsWith('image/')) {
      push(item.getAsFile());
    }
  }

  return out;
}

function normalizeClipboardImageFile(file: File): File {
  if (file.type.startsWith('image/')) return file;

  const lower = file.name.toLowerCase();
  if (/\.jpe?g$/i.test(lower)) {
    return new File([file], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
  }
  if (/\.webp$/i.test(lower)) {
    return new File([file], file.name, { type: 'image/webp', lastModified: file.lastModified });
  }
  if (/\.png$/i.test(lower)) {
    return new File([file], file.name, { type: 'image/png', lastModified: file.lastModified });
  }

  const baseName = file.name && file.name !== 'blob' ? file.name.replace(/\.[^.]+$/, '') : 'screenshot';
  return new File([file], `${baseName}-${Date.now()}.png`, {
    type: 'image/png',
    lastModified: file.lastModified,
  });
}
