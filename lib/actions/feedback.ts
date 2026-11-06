'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendFeedbackReportNotification } from '@/lib/email/feedback-notification';
import { getActionContext, requireSuperadmin } from '@/lib/auth/session';
import { displayName } from '@/lib/auth/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  deletePrivateFile,
  FEEDBACK_SCREENSHOT_MAX_COUNT,
  FEEDBACK_SCREENSHOTS_BUCKET,
  getSignedFileUrls,
  uploadFeedbackScreenshot,
  validateFeedbackScreenshotFile,
} from '@/lib/supabase/storage';
import type {
  FeedbackReport,
  FeedbackReportAttachment,
  FeedbackReportPriority,
  FeedbackReportStatus,
  Profile,
  Tenant,
} from '@/lib/types/database';

const submitSchema = z.object({
  kind: z.enum(['bug', 'feedback']),
  title: z.string().trim().min(1, 'Titel fehlt').max(200),
  description: z.string().trim().min(1, 'Beschreibung fehlt').max(8000),
  page_url: z.string().trim().max(2000).optional(),
  user_agent: z.string().trim().max(500).optional(),
});

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitFeedbackReport(formData: FormData): Promise<SubmitFeedbackResult> {
  const ctx = await getActionContext();
  const parsed = submitSchema.safeParse({
    kind: formData.get('kind'),
    title: formData.get('title'),
    description: formData.get('description'),
    page_url: formData.get('page_url') || undefined,
    user_agent: formData.get('user_agent') || undefined,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Ungültige Eingabe';
    return { ok: false, error: msg };
  }

  const files = formData.getAll('screenshots').filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
  if (files.length > FEEDBACK_SCREENSHOT_MAX_COUNT) {
    return { ok: false, error: `Maximal ${FEEDBACK_SCREENSHOT_MAX_COUNT} Screenshots` };
  }

  try {
    for (const file of files) {
      validateFeedbackScreenshotFile(file);
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Ungültiger Screenshot' };
  }

  const admin = createAdminClient();
  const { data: report, error: reportError } = await admin
    .from('feedback_reports')
    .insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      description: parsed.data.description,
      page_url: parsed.data.page_url ?? null,
      user_agent: parsed.data.user_agent ?? null,
    })
    .select('*')
    .single();

  if (reportError || !report) {
    return { ok: false, error: reportError?.message ?? 'Speichern fehlgeschlagen' };
  }

  const attachmentRows: Omit<FeedbackReportAttachment, 'id' | 'created_at'>[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    try {
      const { path, mime } = await uploadFeedbackScreenshot(ctx.tenantId, report.id, file, i);
      attachmentRows.push({
        report_id: report.id,
        tenant_id: ctx.tenantId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: mime,
      });
    } catch (err) {
      for (const row of attachmentRows) {
        await deletePrivateFile(ctx.tenantId, FEEDBACK_SCREENSHOTS_BUCKET, row.storage_path);
      }
      await admin.from('feedback_reports').delete().eq('id', report.id);
      return { ok: false, error: err instanceof Error ? err.message : 'Upload fehlgeschlagen' };
    }
  }

  if (attachmentRows.length > 0) {
    const { error: attachError } = await admin.from('feedback_report_attachments').insert(attachmentRows);
    if (attachError) {
      for (const row of attachmentRows) {
        await deletePrivateFile(ctx.tenantId, FEEDBACK_SCREENSHOTS_BUCKET, row.storage_path);
      }
      await admin.from('feedback_reports').delete().eq('id', report.id);
      return { ok: false, error: attachError.message };
    }
  }

  const [{ data: tenant }, { data: profile }] = await Promise.all([
    admin.from('tenants').select('name').eq('id', ctx.tenantId).single(),
    admin.from('profiles').select('*').eq('id', ctx.userId).single(),
  ]);

  void sendFeedbackReportNotification({
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description,
    tenantName: tenant?.name ?? ctx.tenantId,
    userName: profile ? displayName(profile as Profile) : ctx.userId,
    userEmail: profile?.email ?? '',
    pageUrl: parsed.data.page_url ?? null,
  });

  return { ok: true };
}

export type FeedbackReportListRow = FeedbackReport & {
  tenant_name: string;
  tenant_slug: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  attachment_count: number;
};

export async function listFeedbackReportsForSuperadmin(): Promise<FeedbackReportListRow[]> {
  await requireSuperadmin();
  const admin = createAdminClient();

  const { data: reports, error } = await admin
    .from('feedback_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !reports?.length) return [];

  const tenantIds = [...new Set(reports.map((r) => r.tenant_id))];
  const userIds = [...new Set(reports.map((r) => r.user_id))];
  const reportIds = reports.map((r) => r.id);

  const [{ data: tenants }, { data: profiles }, { data: attachments }] = await Promise.all([
    admin.from('tenants').select('id, name, slug').in('id', tenantIds),
    admin.from('profiles').select('id, first_name, last_name, email').in('id', userIds),
    admin.from('feedback_report_attachments').select('report_id').in('report_id', reportIds),
  ]);

  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t as Pick<Tenant, 'id' | 'name' | 'slug'>]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const attachCount = new Map<string, number>();
  for (const row of attachments ?? []) {
    attachCount.set(row.report_id, (attachCount.get(row.report_id) ?? 0) + 1);
  }

  return (reports as FeedbackReport[]).map((report) => {
    const tenant = tenantById.get(report.tenant_id);
    const profile = profileById.get(report.user_id);
    return {
      ...report,
      tenant_name: tenant?.name ?? '—',
      tenant_slug: tenant?.slug ?? '—',
      user_first_name: profile?.first_name ?? '',
      user_last_name: profile?.last_name ?? '',
      user_email: profile?.email ?? '',
      attachment_count: attachCount.get(report.id) ?? 0,
    };
  });
}

export type FeedbackReportDetail = FeedbackReportListRow & {
  attachments: { id: string; file_name: string; signed_url: string | null }[];
};

export async function getFeedbackReportDetailForSuperadmin(
  reportId: string,
): Promise<FeedbackReportDetail | null> {
  await requireSuperadmin();
  const admin = createAdminClient();

  const { data: report, error } = await admin
    .from('feedback_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();

  if (error || !report) return null;

  const [{ data: tenant }, { data: profile }, { data: attachmentRows }] = await Promise.all([
    admin.from('tenants').select('id, name, slug').eq('id', report.tenant_id).single(),
    admin.from('profiles').select('id, first_name, last_name, email').eq('id', report.user_id).single(),
    admin.from('feedback_report_attachments').select('*').eq('report_id', report.id),
  ]);

  const paths = (attachmentRows ?? []).map((a) => a.storage_path);
  const signed = await getSignedFileUrls(report.tenant_id, FEEDBACK_SCREENSHOTS_BUCKET, paths, 3600);

  return {
    ...(report as FeedbackReport),
    tenant_name: tenant?.name ?? '—',
    tenant_slug: tenant?.slug ?? '—',
    user_first_name: profile?.first_name ?? '',
    user_last_name: profile?.last_name ?? '',
    user_email: profile?.email ?? '',
    attachment_count: attachmentRows?.length ?? 0,
    attachments: (attachmentRows ?? []).map((a) => ({
      id: a.id,
      file_name: a.file_name,
      signed_url: signed.get(a.storage_path) ?? null,
    })),
  };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'done']),
  priority: z.enum(['low', 'normal', 'high']),
  internal_note: z.string().max(8000).optional(),
});

export async function updateFeedbackReportAdmin(formData: FormData) {
  await requireSuperadmin();
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
    priority: formData.get('priority'),
    internal_note: formData.get('internal_note') ?? '',
  });
  if (!parsed.success) throw new Error('Ungültige Eingabe');

  const admin = createAdminClient();
  const { error } = await admin
    .from('feedback_reports')
    .update({
      status: parsed.data.status as FeedbackReportStatus,
      priority: parsed.data.priority as FeedbackReportPriority,
      internal_note: parsed.data.internal_note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id);

  if (error) throw new Error(error.message);
  revalidatePath('/superadmin');
}

export async function deleteFeedbackReportAdmin(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) throw new Error('ID fehlt');

  const admin = createAdminClient();
  const { data: attachments } = await admin
    .from('feedback_report_attachments')
    .select('tenant_id, storage_path')
    .eq('report_id', id);

  for (const row of attachments ?? []) {
    await deletePrivateFile(row.tenant_id, FEEDBACK_SCREENSHOTS_BUCKET, row.storage_path);
  }

  const { error } = await admin.from('feedback_reports').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin');
}
