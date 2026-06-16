import type { JobRegistration } from '@curvenote/scms-core';
import { KnownJobTypes } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import type { Context } from '../../context.server.js';
import { getUserById, withContext } from '../../context.server.js';
import { createWorkActivity } from '../../db.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { StorageBackend } from '../../storage/index.js';
import { KnownBuckets } from '../../storage/constants.server.js';
import { getHandlers } from '../handlers/index.js';
import { onJobTerminal } from './onJobTerminal.server.js';
import { lastJobMessage } from './jobMessages.server.js';
import { workActivityDataForJob } from './workActivityDataForJob.server.js';

export type RunHandlerOptions = {
  /** Verified handshake binding for this invocation (required for all async job runs). */
  handshakeJob: { jobId: string; jobType: string };
  ctx?: Context;
  extensionJobs?: JobRegistration[];
};

async function resolveContext(options?: RunHandlerOptions): Promise<Context> {
  if (options?.ctx) return options.ctx;
  const request = new Request('http://localhost/internal/jobs/run', { method: 'POST' });
  return withContext({ request, context: {}, params: {} } as any, { noTokens: true });
}

/**
 * Async queue execution: handshake already verified job_id + job_type.
 * Attach claims for handler helpers and load invoked_by user for notifications.
 */
async function applyQueueHandshakeContext(
  ctx: Context,
  job: { id: string; job_type: string; invoked_by_id: string | null },
  handshakeJob: { jobId: string; jobType: string },
) {
  if (handshakeJob.jobId !== job.id || handshakeJob.jobType !== job.job_type) {
    throw new Error('Handshake job binding does not match job row');
  }

  ctx.$verifiedHandshakeToken = 'queue-message';
  ctx.$handshakeClaims = {
    audience: handshakeJob.jobType,
    expiry: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
    jobId: handshakeJob.jobId,
  };

  if (job.invoked_by_id) {
    const dbUser = await getUserById(job.invoked_by_id);
    if (dbUser) {
      ctx.user = { email_verified: false, ...dbUser };
    }
  }

  console.log('[runHandler] queue handshake context', {
    job_id: job.id,
    job_type: job.job_type,
    invoked_by_id: job.invoked_by_id,
    has_user: Boolean(ctx.user),
  });
}

function isTransientError(err: unknown): boolean {
  const errMessage = err instanceof Error ? err.message : String(err);
  return (
    errMessage.includes('ECONNREFUSED') ||
    errMessage.includes('ETIMEDOUT') ||
    errMessage.includes('503') ||
    errMessage.includes('429')
  );
}

async function getHandlerFailureMessage(err: unknown): Promise<string> {
  if (err instanceof Response) {
    try {
      const body = (await err.clone().json()) as { message?: string };
      if (body.message) return body.message;
    } catch {
      // Response body may not be JSON
    }
    return `HTTP ${err.status}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Load a QUEUED job row, run its handler, create work activity, and invoke onJobTerminal.
 * Call only after handshake verification (see processJobMessage).
 */
export async function runHandler(jobId: string, options: RunHandlerOptions) {
  if (options.handshakeJob.jobId !== jobId) {
    throw new Error('runHandler handshakeJob.jobId must match jobId');
  }

  const prisma = await getPrismaClient();
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    console.warn('[runHandler] job not found', { job_id: jobId });
    return null;
  }

  if (job.status !== JobStatus.QUEUED) {
    console.log('[runHandler] skip — status is not QUEUED', {
      job_id: jobId,
      status: job.status,
    });
    return job;
  }

  const ctx = await resolveContext(options);
  await applyQueueHandshakeContext(ctx, job, options.handshakeJob);
  const extensionJobs = options.extensionJobs ?? [];
  const handlers = getHandlers(extensionJobs);

  if (!handlers[job.job_type]) {
    throw new Error(`Unknown job type: ${job.job_type}`);
  }

  const coreJobsRequiringStorage = [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH];
  const extensionJobsRequiringStorage = extensionJobs
    .filter((j) => j.requiresStorageBackend)
    .map((j) => j.jobType);
  const jobsRequiringStorage = [...coreJobsRequiringStorage, ...extensionJobsRequiringStorage];

  const storageBackend = jobsRequiringStorage.includes(job.job_type)
    ? new StorageBackend(ctx, [KnownBuckets.pub, KnownBuckets.prv])
    : undefined;

  const payload = job.payload as Record<string, unknown>;

  console.log('[runHandler] invoking handler', {
    job_id: jobId,
    job_type: job.job_type,
    needs_storage: Boolean(storageBackend),
  });

  let dbo;
  try {
    dbo = await handlers[job.job_type](
      ctx,
      {
        id: job.id,
        job_type: job.job_type,
        payload,
        follow_on: job.follow_on as any,
        invoked_by_id: job.invoked_by_id ?? undefined,
        activity_type: job.activity_type ?? undefined,
      },
      storageBackend,
    );
  } catch (err) {
    if (isTransientError(err)) {
      throw err;
    }
    const errMessage = await getHandlerFailureMessage(err);
    const failureMessage = errMessage ? `Handler failed: ${errMessage}` : 'Handler failed';
    console.error('[runHandler] handler failed', {
      job_id: jobId,
      job_type: job.job_type,
      errMessage: failureMessage,
      err,
    });
    const current = await prisma.job.findUnique({ where: { id: jobId } });
    if (current?.status === JobStatus.FAILED && lastJobMessage(current.messages)) {
      dbo = current;
    } else {
      dbo = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          messages: { push: failureMessage },
        },
      });
    }
  }

  const workVersionId = payload?.work_version_id;
  if (job.activity_type && job.invoked_by_id && typeof workVersionId === 'string') {
    try {
      const wv = await prisma.workVersion.findUnique({
        where: { id: workVersionId },
        select: { work_id: true },
      });
      if (wv) {
        await createWorkActivity({
          workId: wv.work_id,
          workVersionId,
          activityById: job.invoked_by_id,
          activityType: job.activity_type as 'CONVERTER_TASK_STARTED' | 'CHECK_STARTED',
          data: workActivityDataForJob(job.activity_type, job.payload),
        });
      }
    } catch (err) {
      console.error('[runHandler] Failed to create work activity', job.activity_type, err);
    }
  }

  const terminalStatus = dbo?.status ?? job.status;
  if (
    terminalStatus === JobStatus.COMPLETED ||
    terminalStatus === JobStatus.FAILED ||
    terminalStatus === JobStatus.CANCELLED
  ) {
    await onJobTerminal(jobId, terminalStatus);
  }

  return dbo;
}
