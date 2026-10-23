export const DEFAULT_BRAND_COLOR = '#ef684a';
export const DEFAULT_ACCENT_COLOR = '#f2c94c';
export const DEFAULT_SIDEBAR_COLOR = '#202b33';
export const DEFAULT_SIDEBAR_TEXT_COLOR = '#fff9ef';
export const DEFAULT_SURFACE_COLOR = '#eeeae3';
export const DEFAULT_PLATFORM_NAME = 'BauDiggie';

export function getRootDomain() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';
}

export function getPlatformName() {
  return process.env.NEXT_PUBLIC_PLATFORM_NAME ?? DEFAULT_PLATFORM_NAME;
}

export function extractSubdomain(host: string): string | null {
  const rootDomain = getRootDomain();
  const hostname = host.split(':')[0].toLowerCase();

  if (hostname === 'localhost' || hostname === rootDomain.split(':')[0]) {
    return null;
  }

  const rootHost = rootDomain.split(':')[0];
  if (hostname.endsWith(`.${rootHost}`)) {
    const sub = hostname.slice(0, -(rootHost.length + 1));
    if (sub && sub !== 'www') return sub;
  }

  if (hostname.endsWith('.localhost')) {
    const sub = hostname.replace('.localhost', '');
    if (sub && sub !== 'www') return sub;
  }

  return null;
}

export function tenantAppUrl(slug: string) {
  const root = getRootDomain();
  const rootHost = root.split(':')[0];
  const port = root.includes(':') ? `:${root.split(':')[1]}` : '';

  if (rootHost === 'localhost') {
    return `http://${slug}.localhost${port}`;
  }

  return `https://${slug}.${rootHost}${port}`;
}
