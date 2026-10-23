'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';

export async function markInfoboardPostsRead(postIds: string[]) {
  const ids = [...new Set(postIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return;

  const ctx = await getActionContext();
  if (!canAccess(ctx, 'nav.infoboard')) throw new Error('Keine Berechtigung');

  const { tenantId, userId } = ctx;
  const supabase = await createClient();
  const now = new Date().toISOString();

  const rows = ids.map((postId) => ({
    post_id: postId,
    user_id: userId,
    tenant_id: tenantId,
    read_at: now,
  }));

  const { error } = await supabase.from('infoboard_post_reads').upsert(rows, {
    onConflict: 'post_id,user_id',
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app');
}
