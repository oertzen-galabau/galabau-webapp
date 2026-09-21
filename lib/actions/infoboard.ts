'use server';

import { revalidatePath } from 'next/cache';
import { compactDashboardLayout } from '@/lib/infoboard/layout';
import { allowedWidgetIds } from '@/lib/infoboard/widgets';
import { clampLayoutItem, dashboardLayoutSchema } from '@/lib/infoboard/schema';
import type { DashboardLayout } from '@/lib/infoboard/types';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export type SaveDashboardLayoutResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveDashboardLayout(
  layout: DashboardLayout,
): Promise<SaveDashboardLayoutResult> {
  try {
    const ctx = await getActionContext();
    if (!canAccess(ctx, 'infoboard.customize')) {
      return { ok: false, error: 'Keine Berechtigung.' };
    }

    const parsed = dashboardLayoutSchema.safeParse(layout);
    if (!parsed.success) {
      return { ok: false, error: 'Ungültiges Layout.' };
    }

    const permitted = new Set(
      allowedWidgetIds(ctx.permissions, ctx.isSuperadminBypass),
    );

    const sanitized = compactDashboardLayout({
      version: 1,
      items: parsed.data.items
        .filter((item) => permitted.has(item.id))
        .map(clampLayoutItem),
    });

    const admin = createAdminClient();
    const { error } = await admin
      .from('profiles')
      .update({ dashboard_layout: sanitized })
      .eq('id', ctx.userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath('/app');
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
    return { ok: false, error: message };
  }
}
