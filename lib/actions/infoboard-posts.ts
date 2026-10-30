'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { isInfoboardPostType } from '@/lib/infoboard/post-types';

const TITLE_MAX = 200;
const CONTENT_MAX = 5000;

type ParsedPostInput = {
  title: string;
  content: string;
  postType: string;
  publishedAt: string;
  isImportant: boolean;
  importantUntil: string | null;
};

function requirePostsPermission(ctx: Awaited<ReturnType<typeof getActionContext>>) {
  if (!canAccess(ctx, 'infoboard.posts')) throw new Error('Keine Berechtigung');
}

function parsePostFormData(formData: FormData): ParsedPostInput {
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const postType = String(formData.get('post_type') ?? 'news').trim();
  const publishedDate = String(formData.get('published_date') ?? '').trim();
  const publishedTime = String(formData.get('published_time') ?? '08:00').trim() || '08:00';

  if (!title) throw new Error('Titel ist erforderlich');
  if (title.length > TITLE_MAX) throw new Error(`Titel darf maximal ${TITLE_MAX} Zeichen haben`);
  if (!content) throw new Error('Inhalt ist erforderlich');
  if (content.length > CONTENT_MAX) throw new Error(`Inhalt darf maximal ${CONTENT_MAX} Zeichen haben`);
  if (!isInfoboardPostType(postType)) throw new Error('Ungültiger Beitragstyp');

  let publishedAt: string;
  if (publishedDate) {
    publishedAt = new Date(`${publishedDate}T${publishedTime}:00`).toISOString();
    if (Number.isNaN(new Date(publishedAt).getTime())) {
      throw new Error('Ungültiges Datum oder Uhrzeit');
    }
  } else if (postType === 'termin') {
    throw new Error('Termine benötigen ein Datum');
  } else {
    publishedAt = new Date().toISOString();
  }

  const isImportant = formData.get('is_important') === 'on';
  const importantUntilDate = String(formData.get('important_until_date') ?? '').trim();

  let importantUntil: string | null = null;
  if (isImportant && importantUntilDate) {
    importantUntil = new Date(`${importantUntilDate}T23:59:59`).toISOString();
    if (Number.isNaN(new Date(importantUntil).getTime())) {
      throw new Error('Ungültiges Ablaufdatum für „Wichtig“');
    }
    if (new Date(importantUntil).getTime() <= Date.now()) {
      throw new Error('„Wichtig bis“ muss in der Zukunft liegen');
    }
  }

  return { title, content, postType, publishedAt, isImportant, importantUntil };
}

export async function saveInfoboardPost(formData: FormData) {
  const ctx = await getActionContext();
  requirePostsPermission(ctx);
  const { tenantId, userId } = ctx;

  const input = parsePostFormData(formData);
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from('infoboard_posts')
    .insert({
      tenant_id: tenantId,
      title: input.title,
      content: input.content,
      post_type: input.postType,
      published_at: input.publishedAt,
      is_important: input.isImportant,
      important_until: input.importantUntil,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (inserted?.id) {
    await supabase.from('infoboard_post_reads').upsert(
      {
        post_id: inserted.id,
        user_id: userId,
        tenant_id: tenantId,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'post_id,user_id' },
    );
  }
  revalidatePath('/app');
}

export async function updateInfoboardPost(formData: FormData) {
  const ctx = await getActionContext();
  requirePostsPermission(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '').trim();
  if (!id) throw new Error('Kein Beitrag ausgewählt');

  const input = parsePostFormData(formData);
  const supabase = await createClient();

  const { error } = await supabase
    .from('infoboard_posts')
    .update({
      title: input.title,
      content: input.content,
      post_type: input.postType,
      published_at: input.publishedAt,
      is_important: input.isImportant,
      important_until: input.importantUntil,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app');
}

export async function deleteInfoboardPost(formData: FormData) {
  const ctx = await getActionContext();
  requirePostsPermission(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '').trim();
  if (!id) throw new Error('Kein Beitrag ausgewählt');

  const supabase = await createClient();
  const { error } = await supabase
    .from('infoboard_posts')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app');
}
