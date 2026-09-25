import { data } from 'react-router';
import { userHasScope, enqueueAndDispatchJob, getPrismaClient } from '@curvenote/scms-server';
import type { WorkContext } from '@curvenote/scms-server';
import { hasDocxInMetadata, scopes } from '@curvenote/scms-core';
import { isMystCurvenoteWebPayload } from '../works.$workId.details/webConversionJob';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { uuidv7 } from 'uuidv7';

export const ExportToPdfActionSchema = zfd.formData({
  intent: zfd.text(z.literal('export-to-pdf')),
  workVersionId: zfd.text(z.string().uuid()),
});

export async function exportToPdfAction(ctx: WorkContext, formData: FormData) {
  const parsed = ExportToPdfActionSchema.safeParse(formData);
  if (!parsed.success) {
    return data(
      { error: { type: 'general' as const, message: 'Invalid form data' } },
      { status: 400 },
    );
  }

  const { workVersionId } = parsed.data;

  if (!userHasScope(ctx.user, scopes.app.works.export)) {
    return data(
      {
        error: {
          type: 'general' as const,
          message: 'You do not have permission to export to PDF.',
        },
      },
      { status: 403 },
    );
  }

  const prisma = await getPrismaClient();
  const workVersion = await prisma.workVersion.findUnique({
    where: { id: workVersionId },
  });

  if (!workVersion || workVersion.work_id !== ctx.work.id) {
    return data(
      { error: { type: 'general' as const, message: 'Work version not found.' } },
      { status: 404 },
    );
  }

  if (!hasDocxInMetadata(workVersion.metadata)) {
    return data(
      { error: { type: 'general' as const, message: 'No Word document found in this version.' } },
      { status: 400 },
    );
  }

  try {
    const jobId = uuidv7();
    const result = await enqueueAndDispatchJob({
      job_id: jobId,
      job_type: 'CONVERTER_TASK',
      payload: {
        work_version_id: workVersionId,
        target: 'pdf',
        conversion_type: 'docx-pd-curvenote-pdf',
      },
      invoked_by_id: ctx.user?.id,
    });
    return data({ success: true, jobId: result.job_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export to PDF failed.';
    return data({ error: { type: 'general' as const, message } }, { status: 500 });
  }
}

export const RetryWebConversionActionSchema = zfd.formData({
  intent: zfd.text(z.literal('retry-web-conversion')),
  workVersionId: zfd.text(z.string().uuid()),
});

/**
 * Re-enqueue myst-curvenote-web for a work version (timeline Retry).
 * Requires web-article-generation scope (same gate as the Web Version timeline row).
 */
export async function retryWebConversionAction(ctx: WorkContext, formData: FormData) {
  const parsed = RetryWebConversionActionSchema.safeParse(formData);
  if (!parsed.success) {
    return data(
      { error: { type: 'general' as const, message: 'Invalid form data' } },
      { status: 400 },
    );
  }

  const { workVersionId } = parsed.data;

  const canRetry =
    userHasScope(ctx.user, scopes.app.works.webArticleGeneration) ||
    userHasScope(ctx.user, scopes.system.admin);
  if (!canRetry) {
    return data(
      {
        error: {
          type: 'general' as const,
          message: 'You do not have permission to retry web conversion.',
        },
      },
      { status: 403 },
    );
  }

  const prisma = await getPrismaClient();
  const workVersion = await prisma.workVersion.findUnique({
    where: { id: workVersionId },
    select: {
      id: true,
      work_id: true,
      draft: true,
      cdn: true,
      cdn_key: true,
    },
  });

  if (!workVersion || workVersion.work_id !== ctx.work.id) {
    return data(
      { error: { type: 'general' as const, message: 'Work version not found.' } },
      { status: 404 },
    );
  }

  if (workVersion.draft) {
    return data(
      { error: { type: 'general' as const, message: 'Cannot convert a draft work version.' } },
      { status: 400 },
    );
  }

  if (!workVersion.cdn?.trim() || !workVersion.cdn_key?.trim()) {
    return data(
      {
        error: {
          type: 'general' as const,
          message: 'Work version is missing CDN storage; import sources before converting.',
        },
      },
      { status: 400 },
    );
  }

  // Avoid parallel builds to the same CDN key (stale page / direct POST).
  const linked = await prisma.linkedJob.findMany({
    where: { work_version_id: workVersionId },
    include: {
      job: {
        select: { id: true, status: true, job_type: true, payload: true },
      },
    },
  });
  const inFlight = linked.find((row) => {
    if (row.job.job_type !== 'CONVERTER_TASK') return false;
    if (!['QUEUED', 'SCHEDULED', 'RUNNING'].includes(row.job.status)) return false;
    return isMystCurvenoteWebPayload(row.job.payload);
  });
  if (inFlight) {
    return data({ success: true, jobId: inFlight.job.id, alreadyInFlight: true });
  }

  try {
    const jobId = uuidv7();
    const result = await enqueueAndDispatchJob({
      job_id: jobId,
      job_type: 'CONVERTER_TASK',
      payload: {
        work_version_id: workVersionId,
        target: 'web',
        conversion_type: 'myst-curvenote-web',
      },
      invoked_by_id: ctx.user?.id,
    });
    return data({ success: true, jobId: result.job_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Web conversion retry failed.';
    return data({ error: { type: 'general' as const, message } }, { status: 500 });
  }
}
