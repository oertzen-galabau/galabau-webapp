const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.8;

/** Server-Action-Limit (next.config) ist 10 MB inkl. übriger Formularfelder. */
export const MAX_REPORT_PHOTO_UPLOAD_BYTES = 9 * 1024 * 1024;

export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE_PX) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Verkleinert Kamerafotos im Browser; bei nicht decodierbaren Formaten bleibt das Original. */
export async function compressReportPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
