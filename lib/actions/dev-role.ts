'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DEV_ROLE_COOKIE } from '@/lib/auth/session';

export async function setDevRoleOverride(roleId: string | null) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Dev-Rollen-Switcher ist nur in der Entwicklungsumgebung verfügbar.');
  }

  const cookieStore = await cookies();

  if (roleId === null) {
    cookieStore.delete(DEV_ROLE_COOKIE);
  } else if (/^[0-9a-f-]{36}$/i.test(roleId)) {
    cookieStore.set(DEV_ROLE_COOKIE, roleId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  } else {
    throw new Error('Ungültige Rolle.');
  }

  revalidatePath('/app', 'layout');
}
