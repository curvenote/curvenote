import { JobStatus } from '@curvenote/scms-db';
import type { Context } from '../../context.server.js';
import { KnownJobTypes, type CreateJob } from '@curvenote/scms-core';
import { getPrismaClient } from '../../prisma.server.js';
import { cancelSubmissionVersionTransitionOnJobFailure } from './cancelSubmissionVersionTransition.server.js';
import { dbUpdateJob } from './db.server.js';
import { lastJobMessage } from '../run/jobMessages.server.js';

type JobFailedDefaultPayload = {
  failed_job_id: string;
  failed_job_type: string;
  reason: string;
  source: string;
  last_error?: string;
};

/**
 * Idempotent terminal cleanup when a parent job fails or transport is exhausted.
 */
export async function jobFailedDefaultHandler(_ctx: Context, data: CreateJob) {
  const payload = data.payload as JobFailedDefaultPayload;
  const prisma = await getPrismaClient();
  const target = await prisma.job.findUnique({ where: { id: payload.failed_job_id } });
  const targetLastMessage = lastJobMessage(target?.messages);
  const lastError = payload.last_error ?? targetLastMessage ?? `Job failed (${payload.reason})`;

  console.log('[JOB_FAILED_DEFAULT]', {
    cleanup_job_id: data.id,
    failed_job_id: payload.failed_job_id,
    failed_job_type: payload.failed_job_type,
    reason: payload.reason,
    source: payload.source,
    last_error: lastError,
    target_status: target?.status,
  });

  if (
    target &&
    target.status !== JobStatus.COMPLETED &&
    target.status !== JobStatus.FAILED &&
    target.status !== JobStatus.CANCELLED
  ) {
    await dbUpdateJob(payload.failed_job_id, {
      status: JobStatus.FAILED,
      message: lastError,
    });
  }

  if (
    target &&
    (target.job_type === KnownJobTypes.PUBLISH || target.job_type === KnownJobTypes.UNPUBLISH)
  ) {
    const jobPayload = target.payload as Record<string, unknown> | null;
    const submissionVersionId = jobPayload?.submission_version_id;
    const userId =
      (typeof jobPayload?.user_id === 'string' ? jobPayload.user_id : undefined) ??
      target.invoked_by_id;
    if (typeof submissionVersionId === 'string' && userId) {
      await cancelSubmissionVersionTransitionOnJobFailure({
        submission_version_id: submissionVersionId,
        job_id: payload.failed_job_id,
        user_id: userId,
        error: lastError,
        job_type: target.job_type,
      });
    }
  }

  return dbUpdateJob(data.id, {
    status: JobStatus.COMPLETED,
    message: 'JOB_FAILED_DEFAULT cleanup complete',
    results: {
      failed_job_id: payload.failed_job_id,
      failed_job_type: payload.failed_job_type,
      reason: payload.reason,
      source: payload.source,
      last_error: lastError,
    },
  });
}
