import { JobStatus } from '@curvenote/scms-db';
import type { Job } from '@curvenote/scms-db';
import { KnownJobTypes, coerceToObject } from '@curvenote/scms-core';
import { converterActivityFromPayload } from '../../jobs/converterActivityFromPayload.server.js';
import { createWorkActivity } from '../../db.server.js';
import { getPrismaClient } from '../../prisma.server.js';

type TerminalStatus =
  | typeof JobStatus.COMPLETED
  | typeof JobStatus.FAILED
  | typeof JobStatus.CANCELLED;

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  const obj = coerceToObject(payload);
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
}

/**
 * Logs a work timeline activity when an async CONVERTER_TASK job reaches a terminal status
 * (worker PATCH via loaders/jobs/update.server.ts).
 *
 * Best-effort only: callers must not rely on this succeeding and should run critical terminal
 * handling (e.g. onJobTerminal) before invoking this helper.
 */
export async function recordConverterTaskTerminalActivity(
  job: Job,
  status: TerminalStatus,
): Promise<void> {
  try {
    if (job.job_type !== KnownJobTypes.CONVERTER_TASK || !job.invoked_by_id) {
      return;
    }

    const payload = payloadRecord(job.payload);
    let workVersionId =
      typeof payload?.work_version_id === 'string' ? payload.work_version_id : undefined;

    const prisma = await getPrismaClient();
    if (!workVersionId) {
      const linked = await prisma.linkedJob.findFirst({
        where: { job_id: job.id },
        select: { work_version_id: true },
      });
      workVersionId = linked?.work_version_id ?? undefined;
    }
    if (!workVersionId) {
      console.warn('[recordConverterTaskTerminalActivity] missing work_version_id', {
        job_id: job.id,
      });
      return;
    }

    const workVersion = await prisma.workVersion.findUnique({
      where: { id: workVersionId },
      select: { work_id: true },
    });
    if (!workVersion) {
      console.warn('[recordConverterTaskTerminalActivity] work version not found', {
        job_id: job.id,
        work_version_id: workVersionId,
      });
      return;
    }

    const activityType =
      status === JobStatus.COMPLETED ? 'CONVERTER_TASK_COMPLETED' : 'CONVERTER_TASK_FAILED';

    const results = payloadRecord(job.results);
    const messages = Array.isArray(job.messages) ? job.messages : [];
    const lastMessage = messages.length > 0 ? String(messages[messages.length - 1]) : undefined;

    const data: Record<string, unknown> = {
      converter: converterActivityFromPayload(payload),
      job_id: job.id,
    };
    if (status === JobStatus.FAILED || status === JobStatus.CANCELLED) {
      data.error =
        lastMessage ??
        results?.error ??
        (status === JobStatus.CANCELLED
          ? 'Document conversion was cancelled.'
          : 'Conversion failed');
    }

    await createWorkActivity({
      workId: workVersion.work_id,
      workVersionId,
      activityById: job.invoked_by_id,
      activityType,
      data,
    });
  } catch (err) {
    console.error('[recordConverterTaskTerminalActivity] failed', {
      job_id: job.id,
      status,
      err,
    });
  }
}
