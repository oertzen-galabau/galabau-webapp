/** Entfernt alte Supabase-Auth-Cookies vor einem neuen Login (verhindert Header-Überlauf). */
export function clearSupabaseAuthCookies() {
  if (typeof document === 'undefined') return;

  document.cookie.split(';').forEach((part) => {
    const name = part.split('=')[0]?.trim();
    if (!name?.startsWith('sb-')) return;
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  });
}
