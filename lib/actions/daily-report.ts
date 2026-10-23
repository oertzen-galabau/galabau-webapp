'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { PermissionKey } from '@/lib/auth/permissions';
import {
  dataUrlToBuffer,
  parseResourceRows,
  assertSignatureMetadata,
  parseSignatureInputs,
  parseDeliveryBlocks,
  parseSubcontractorPersonRows,
  parseWorkerHoursRows,
  parseWorkItemRows,
  validatePhotoCount,
} from '@/lib/documentation/report-validation';
import { insertDeliveryNote } from '@/lib/documentation/save-delivery-note';
import { resolvePartnerName } from '@/lib/actions/partners';
import { loadTenantGpsEnabled } from '@/lib/tenant/gps';
import { buildStoragePath, deletePrivateFile, uploadPrivateFile } from '@/lib/supabase/storage';
import {
  isHourlyWageRapport,
  parseDailyLogReportType,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';
import { requireSiteAccess } from '@/lib/sites/access';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

async function requireCanManageDailyReportForSiteDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: Awaited<ReturnType<typeof getActionContext>>,
  siteId: string,
  logDate: string,
  existingLog?: { created_by: string | null } | null,
) {
  const { requireCanManageDailyReportForSiteDate: requireManage } = await import(
    '@/lib/documentation/report-access'
  );
  await requireManage(supabase, ctx, siteId, logDate, existingLog);
}

async function replaceChildRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  dailyLogId: string,
  formData: FormData,
  reportType: DailyLogReportType,
) {
  const hourly = isHourlyWageRapport(reportType);

  await supabase.from('daily_log_work').delete().eq('daily_log_id', dailyLogId);
  await supabase.from('daily_log_worker_hours').delete().eq('daily_log_id', dailyLogId);
  await supabase.from('equipment_hours').delete().eq('daily_log_id', dailyLogId);

  const workItems = parseWorkItemRows(formData);
  if (workItems.length > 0) {
    const { error } = await supabase.from('daily_log_work').insert(
      workItems.map((item) => ({
        tenant_id: tenantId,
        daily_log_id: dailyLogId,
        description: item.description,
        worker_hours: 0,
        quantity: item.quantity,
        unit: item.unit,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (!hourly) return;

  const workers = parseWorkerHoursRows(formData);
  if (workers.length > 0) {
    const userIds = workers.map((row) => row.userId).filter((id): id is string => Boolean(id));
    const { data: profiles } = userIds.length
      ? await supabase
          .from('profiles')
          .select('id, first_name, last_name, job_title')
          .eq('tenant_id', tenantId)
          .in('id', userIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    const { error } = await supabase.from('daily_log_worker_hours').insert(
      workers.map((row) => {
        const profile = row.userId ? profileById.get(row.userId) : null;
        const workerName =
          row.workerName ||
          (profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unbekannt');
        return {
          tenant_id: tenantId,
          daily_log_id: dailyLogId,
          user_id: row.userId,
          worker_name: workerName,
          job_title: row.jobTitle || profile?.job_title || null,
          hours: row.hours,
        };
      }),
    );
    if (error) throw new Error(error.message);
  }

  const resources = parseResourceRows(formData);
  if (resources.length > 0) {
    const { error } = await supabase.from('equipment_hours').insert(
      resources.map((item) => ({
        tenant_id: tenantId,
        daily_log_id: dailyLogId,
        equipment_name: item.name,
        hours: item.hours ?? (item.unit === 'Std.' ? item.quantity ?? 0 : 0),
        quantity: item.quantity,
        unit: item.unit,
      })),
    );
    if (error) throw new Error(error.message);
  }

  await supabase
    .from('subcontractor_entries')
    .delete()
    .eq('daily_log_id', dailyLogId)
    .is('deleted_at', null);

  const subcontractorRows = parseSubcontractorPersonRows(formData);
  for (const row of subcontractorRows) {
    const { partnerId: resolvedPartnerId, displayName: companyName } = await resolvePartnerName(
      tenantId,
      row.partnerId,
      row.companyName,
      'subcontractor',
    );
    const { error } = await supabase.from('subcontractor_entries').insert({
      tenant_id: tenantId,
      daily_log_id: dailyLogId,
      partner_id: resolvedPartnerId,
      company_name: companyName,
      work_description: row.workDescription,
      worker_name: row.workerName,
      group_key: row.groupKey,
      hours: row.hours,
    });
    if (error) throw new Error(error.message);
  }
}

async function saveSignatures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  siteId: string,
  dailyLogId: string,
  formData: FormData,
) {
  const gpsEnabled = await loadTenantGpsEnabled(supabase, tenantId);
  const signatures = parseSignatureInputs(formData).map((signature) =>
    gpsEnabled
      ? signature
      : { ...signature, signedLatitude: null, signedLongitude: null, signedLocationLabel: null },
  );

  for (const signature of signatures) {
    const { data: existing } = await supabase
      .from('daily_log_signatures')
      .select('id, file_url')
      .eq('daily_log_id', dailyLogId)
      .eq('role', signature.role)
      .maybeSingle();

    if (signature.remove) {
      if (existing?.file_url) await deletePrivateFile(tenantId, 'daily-photos', existing.file_url);
      if (existing) {
        await supabase.from('daily_log_signatures').delete().eq('id', existing.id);
      }
      continue;
    }

    if (signature.dataUrl) {
      assertSignatureMetadata(signature, gpsEnabled);
      const { buffer, mime } = dataUrlToBuffer(signature.dataUrl);
      const ext = mime.includes('png') ? 'png' : 'jpg';
      const path = buildStoragePath(tenantId, siteId, dailyLogId, `signature-${signature.role}.${ext}`);
      const file = new File([new Uint8Array(buffer)], `signature-${signature.role}.${ext}`, { type: mime });
      await uploadPrivateFile(tenantId, 'daily-photos', path, file);

      if (existing?.file_url && existing.file_url !== path) {
        await deletePrivateFile(tenantId, 'daily-photos', existing.file_url);
      }

      const { error } = await supabase.from('daily_log_signatures').upsert(
        {
          tenant_id: tenantId,
          daily_log_id: dailyLogId,
          role: signature.role,
          signer_name: signature.signerName,
          file_url: path,
          signed_at: signature.signedAt!,
          signed_latitude: signature.signedLatitude,
          signed_longitude: signature.signedLongitude,
          signed_location_label: signature.signedLocationLabel,
        },
        { onConflict: 'daily_log_id,role' },
      );
      if (error) throw new Error(error.message);
    } else if (!signature.keepExisting && existing) {
      if (existing.file_url) await deletePrivateFile(tenantId, 'daily-photos', existing.file_url);
      await supabase.from('daily_log_signatures').delete().eq('id', existing.id);
    } else if (signature.signerName && existing) {
      await supabase
        .from('daily_log_signatures')
        .update({ signer_name: signature.signerName })
        .eq('id', existing.id);
    }
  }
}

export async function saveDailyReport(formData: FormData) {
  const ctx = await getActionContext();
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const siteId = String(formData.get('site_id') ?? '').trim();
  const logDate = String(formData.get('log_date') ?? '').trim();
  const existingLogId = String(formData.get('daily_log_id') ?? '').trim() || null;

  if (!siteId || !logDate) throw new Error('Baustelle und Datum sind erforderlich');

  await requireSiteAccess(supabase, ctx, siteId, { planDate: logDate });

  let reportType = parseDailyLogReportType(String(formData.get('report_type') ?? ''));

  const removedPhotoIds = formData.getAll('removed_photo_id[]').map((id) => String(id));
  const photoFiles = formData.getAll('photos').filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );

  let logId = existingLogId;

  if (existingLogId) {
    const { data: existingLog, error: loadError } = await supabase
      .from('daily_logs')
      .select('id, tenant_id, site_id, report_type, created_by')
      .eq('id', existingLogId)
      .single();
    if (loadError || !existingLog) throw new Error('Tageseintrag nicht gefunden');
    if (existingLog.tenant_id !== tenantId) throw new Error('Keine Berechtigung');
    await requireCanManageDailyReportForSiteDate(
      supabase,
      ctx,
      existingLog.site_id,
      logDate,
      { created_by: existingLog.created_by as string | null },
    );
    await requireSiteAccess(supabase, ctx, existingLog.site_id, { planDate: logDate });
    if (siteId !== existingLog.site_id) {
      await requireCanManageDailyReportForSiteDate(supabase, ctx, siteId, logDate, null);
    }
    reportType = parseDailyLogReportType(existingLog.report_type as string);

    const { data: activePhotos } = await supabase
      .from('daily_log_photos')
      .select('id')
      .eq('daily_log_id', existingLogId)
      .is('deleted_at', null);

    validatePhotoCount(activePhotos?.length ?? 0, photoFiles.length, removedPhotoIds.length);

    const { error } = await supabase
      .from('daily_logs')
      .update({
        site_id: siteId,
        log_date: logDate,
        weather: String(formData.get('weather') ?? '').trim() || null,
        notes: String(formData.get('notes') ?? '').trim() || null,
        dictation_transcript: String(formData.get('dictation_transcript') ?? '').trim() || null,
        dictation_extraction: formData.get('dictation_extraction')
          ? (JSON.parse(String(formData.get('dictation_extraction'))) as Record<string, unknown>)
          : null,
      })
      .eq('id', existingLogId);
    if (error) throw new Error(error.message);

    await replaceChildRows(supabase, tenantId, existingLogId, formData, reportType);
    if (isHourlyWageRapport(reportType)) {
      await saveSignatures(supabase, tenantId, siteId, existingLogId, formData);
    } else {
      const { data: existingSignatures } = await supabase
        .from('daily_log_signatures')
        .select('id, file_url')
        .eq('daily_log_id', existingLogId);
      for (const signature of existingSignatures ?? []) {
        if (signature.file_url) await deletePrivateFile(tenantId, 'daily-photos', signature.file_url);
        await supabase.from('daily_log_signatures').delete().eq('id', signature.id);
      }
    }

    for (const photoId of removedPhotoIds) {
      const { data: photo } = await supabase
        .from('daily_log_photos')
        .select('id, tenant_id, deleted_at')
        .eq('id', photoId)
        .single();
      if (!photo || photo.tenant_id !== tenantId || photo.deleted_at) continue;
      await supabase
        .from('daily_log_photos')
        .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
        .eq('id', photoId);
    }
  } else {
    await requireCanManageDailyReportForSiteDate(supabase, ctx, siteId, logDate, null);
    validatePhotoCount(0, photoFiles.length, 0);

    const { data: log, error } = await supabase
      .from('daily_logs')
      .upsert(
        {
          tenant_id: tenantId,
          site_id: siteId,
          log_date: logDate,
          weather: String(formData.get('weather') ?? '').trim() || null,
          notes: String(formData.get('notes') ?? '').trim() || null,
          created_by: userId,
          dictation_transcript: String(formData.get('dictation_transcript') ?? '').trim() || null,
          dictation_extraction: formData.get('dictation_extraction')
            ? (JSON.parse(String(formData.get('dictation_extraction'))) as Record<string, unknown>)
            : null,
          report_type: reportType,
          custom_title: null,
        },
        { onConflict: 'tenant_id,site_id,log_date,report_type' },
      )
      .select('*')
      .single();

    if (error || !log) throw new Error(error?.message ?? 'Fehler beim Speichern');
    logId = log.id;

    await replaceChildRows(supabase, tenantId, log.id, formData, reportType);
    if (isHourlyWageRapport(reportType)) {
      await saveSignatures(supabase, tenantId, siteId, log.id, formData);
    }
  }

  if (!logId) throw new Error('Tageseintrag konnte nicht gespeichert werden');

  for (const file of photoFiles) {
    const path = buildStoragePath(tenantId, siteId, logId, `${Date.now()}-${file.name}`);
    await uploadPrivateFile(tenantId, 'daily-photos', path, file);
    await supabase.from('daily_log_photos').insert({
      tenant_id: tenantId,
      daily_log_id: logId,
      file_url: path,
      uploaded_by: userId,
    });
  }

  if (!isHourlyWageRapport(reportType)) {
    const deliveryBlocks = parseDeliveryBlocks(formData);
    for (const block of deliveryBlocks) {
      await insertDeliveryNote(supabase, tenantId, logId, block);
    }
  }

  revalidatePath('/app/dokumentation');
  revalidatePath('/app/dokumente');
  revalidatePath(`/app/baustellen/${siteId}`);
  return { logId };
}
