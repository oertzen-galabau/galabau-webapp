import { createAdminClient } from '@/lib/supabase/admin';
import { getSupabaseUrl } from '@/lib/supabase/env';
import {
  assertStoragePathBelongsToTenant,
  storagePathBelongsToTenant,
} from '@/lib/tenant/row-access';

export type PrivateBucket = 'site-documents' | 'daily-photos' | 'reports' | 'equipment-photos';

export const EQUIPMENT_PHOTOS_BUCKET = 'equipment-photos' as const;
const EQUIPMENT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const EQUIPMENT_PHOTO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EQUIPMENT_PHOTO_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const TENANT_LOGOS_BUCKET = 'tenant-logos';
const TENANT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
const TENANT_LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const TENANT_LOGO_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * Lädt eine Datei in einen privaten Storage-Bucket hoch und gibt den
 * gespeicherten Objekt-Pfad zurück (kein öffentliches URL, da die Buckets
 * `site-documents`, `daily-photos` und `reports` nicht öffentlich sind).
 */
export async function uploadPrivateFile(
  tenantId: string,
  bucket: PrivateBucket,
  path: string,
  file: File,
) {
  assertStoragePathBelongsToTenant(tenantId, path);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Erzeugt eine zeitlich begrenzte signierte URL für ein Objekt in einem
 * privaten Bucket, damit es im Browser (z. B. als Bild oder Download-Link)
 * angezeigt werden kann.
 */
export async function getSignedFileUrl(
  tenantId: string,
  bucket: PrivateBucket,
  path: string | null,
  expiresIn = 3600,
) {
  if (!path) return null;
  assertStoragePathBelongsToTenant(tenantId, path);
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Erzeugt signierte URLs für mehrere Objekte im selben Bucket auf einmal.
 */
export async function getSignedFileUrls(
  tenantId: string,
  bucket: PrivateBucket,
  paths: string[],
  expiresIn = 3600,
) {
  const allowed = paths.filter((path) => storagePathBelongsToTenant(tenantId, path));
  if (allowed.length === 0) return new Map<string, string>();
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(allowed, expiresIn);
  const map = new Map<string, string>();
  if (error || !data) return map;
  for (const entry of data) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildStoragePath(...segments: (string | number)[]) {
  return segments
    .map((segment) => (typeof segment === 'string' ? sanitizeFileName(segment) : String(segment)))
    .join('/');
}

/** Entfernt ein Objekt aus einem privaten Bucket (Fehler werden ignoriert). */
export async function deletePrivateFile(tenantId: string, bucket: PrivateBucket, path: string | null) {
  if (!path) return;
  assertStoragePathBelongsToTenant(tenantId, path);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).remove([path]);
  if (error) console.warn(`Storage delete failed (${bucket}/${path}):`, error.message);
}

export function validateEquipmentPhotoFile(file: File) {
  if (file.size === 0) throw new Error('Keine Datei ausgewählt');
  if (file.size > EQUIPMENT_PHOTO_MAX_BYTES) {
    throw new Error('Foto darf maximal 2 MB groß sein');
  }
  const mime = file.type || 'application/octet-stream';
  if (!EQUIPMENT_PHOTO_MIME_TYPES.has(mime)) {
    throw new Error('Foto muss JPEG, PNG oder WebP sein');
  }
}

export async function uploadEquipmentPhoto(tenantId: string, equipmentId: string, file: File) {
  validateEquipmentPhotoFile(file);
  const ext = EQUIPMENT_PHOTO_EXT_BY_MIME[file.type] ?? 'jpg';
  const path = buildStoragePath(tenantId, equipmentId, `photo.${ext}`);
  await uploadPrivateFile(tenantId, EQUIPMENT_PHOTOS_BUCKET, path, file);
  return path;
}

export function validateSiteCoverPhotoFile(file: File) {
  validateEquipmentPhotoFile(file);
}

export async function uploadSiteCoverPhoto(tenantId: string, siteId: string, file: File) {
  validateSiteCoverPhotoFile(file);
  const ext = EQUIPMENT_PHOTO_EXT_BY_MIME[file.type] ?? 'jpg';
  const path = buildStoragePath(tenantId, siteId, 'cover', `${Date.now()}.${ext}`);
  await uploadPrivateFile(tenantId, 'site-documents', path, file);
  return path;
}

export function validateTenantLogoFile(file: File) {
  if (file.size === 0) throw new Error('Keine Datei ausgewählt');
  if (file.size > TENANT_LOGO_MAX_BYTES) {
    throw new Error('Logo darf maximal 2 MB groß sein');
  }
  const mime = file.type || 'application/octet-stream';
  if (!TENANT_LOGO_MIME_TYPES.has(mime)) {
    throw new Error('Logo muss PNG, JPEG, WebP oder SVG sein');
  }
}

export function getTenantLogoPublicUrl(path: string) {
  return `${getSupabaseUrl()}/storage/v1/object/public/${TENANT_LOGOS_BUCKET}/${path}`;
}

export function tenantLogoStoragePath(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  const prefix = `${getSupabaseUrl()}/storage/v1/object/public/${TENANT_LOGOS_BUCKET}/`;
  if (!logoUrl.startsWith(prefix)) return null;
  return logoUrl.slice(prefix.length);
}

export async function uploadTenantLogo(tenantId: string, file: File) {
  validateTenantLogoFile(file);
  const ext = TENANT_LOGO_EXT_BY_MIME[file.type] ?? 'png';
  const path = buildStoragePath(tenantId, `logo.${ext}`);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(TENANT_LOGOS_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return { path, publicUrl: getTenantLogoPublicUrl(path) };
}

export async function deleteTenantLogo(tenantId: string, logoUrl: string | null) {
  const path = tenantLogoStoragePath(logoUrl);
  if (!path) return;
  assertStoragePathBelongsToTenant(tenantId, path);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(TENANT_LOGOS_BUCKET).remove([path]);
  if (error) console.warn(`Tenant logo delete failed (${path}):`, error.message);
}
