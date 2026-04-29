import {
  withContext,
  jobs,
  registerExtensionJobs,
  verifyHandshakeToken,
  createWorkActivity,
  getPrismaClient,
  StorageBackend,
  KnownBuckets,
} from '@curvenote/scms-server';
import { error405, KnownJobTypes } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { extensions } from '../../../extensions/server';
import { markPermanentDispatchFailure, tryParsePubSubMessage } from './utils.server';

// Extend Vercel timeout — handlers can be long-running (e.g. PUBLISH copies files)
export const config = {
  maxDuration: 300,
};

export function loader() {
  throw error405();
}

/**
 * POST /v1/jobs/dispatch
 *
 * Receives Pub/Sub push messages from the scmsJobDispatch topic.
 * Ensures a QUEUED DB row exists (normally created by `dispatchAJob` before publish),
 * resolves the handler, and runs it.
 *
 * Auth: handshake JWT in message attributes (signed by the publisher with
 * the same handshakeSigningSecret). The JWT's jobId must match the message data.
 *
 * Returns 200 to ack the message. Returns 500 for transient errors (Pub/Sub retries).
 * Permanent errors (bad payload, unknown job type) ack with 200 after marking the job FAILED.
 */
export async function action({ request, context }: { request: Request; context?: any }) {
  console.log('[dispatch] action');
  const args = { request, context, params: {} };
  console.log('[dispatch] args', args);
  const ctx = await withContext(args as any, { noTokens: true });
  console.log('[dispatch] ctx ', ctx === undefined ? 'undefined' : 'defined');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error('[dispatch] Request body is not valid JSON');
    return new Response(null, { status: 200 });
  }

  const parsed = tryParsePubSubMessage(body);
  if (!parsed.ok) {
    console.error('[dispatch] Invalid Pub/Sub envelope', parsed.reason);
    await markPermanentDispatchFailure(parsed.reason, parsed.salvage);
    return new Response(null, { status: 200 });
  }
  const { data, attributes } = parsed;

  console.log('[dispatch] push received', {
    job_id: data.job_id,
    job_type: data.job_type,
    has_handshake: Boolean(attributes.handshake),
    invoked_by_id: data.invoked_by_id,
    activity_type: data.activity_type,
  });

  // Verify the handshake token (invalid JWT or jobId mismatch → permanent failure, ack 200)
  let claims: { jobId: string };
  try {
    claims = verifyHandshakeToken(
      attributes.handshake,
      ctx.$config.api.handshakeIssuer,
      ctx.$config.api.handshakeSigningSecret,
    );
  } catch {
    console.error('[dispatch] Handshake verification failed', {
      job_id: data.job_id,
      job_type: data.job_type,
    });
    await markPermanentDispatchFailure('Invalid handshake token', {
      job_id: data.job_id,
      job_type: data.job_type,
      payload: data.payload,
      invoked_by_id: data.invoked_by_id,
    });
    return new Response(null, { status: 200 });
  }
  if (claims.jobId !== data.job_id) {
    console.error('[dispatch] Handshake jobId mismatch', {
      claim_job_id: claims.jobId,
      message_job_id: data.job_id,
      job_type: data.job_type,
    });
    await markPermanentDispatchFailure('Handshake jobId does not match message job_id', {
      job_id: data.job_id,
      job_type: data.job_type,
      payload: data.payload,
      invoked_by_id: data.invoked_by_id,
    });
    return new Response(null, { status: 200 });
  }

  // Resolve handler
  const extensionJobs = registerExtensionJobs(extensions);
  const handlers = jobs.getHandlers(extensionJobs);
  if (!handlers[data.job_type]) {
    console.error(`[dispatch] Unknown job type: ${data.job_type}`);
    await markPermanentDispatchFailure(`Unknown job type: ${data.job_type}`, {
      job_id: data.job_id,
      job_type: data.job_type,
      payload: data.payload,
      invoked_by_id: data.invoked_by_id,
    });
    return new Response(null, { status: 200 });
  }

  // Ensure DB row (QUEUED) — idempotent: `dispatchAJob` usually inserts first; this covers retries and replays
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: data.job_id } });
  if (existing) {
    // Retry scenario: row exists. If it's already past QUEUED, skip.
    if (existing.status !== JobStatus.QUEUED) {
      console.log('[dispatch] job row exists with non-QUEUED status, skipping handler', {
        job_id: data.job_id,
        job_type: data.job_type,
        status: existing.status,
      });
      return new Response(null, { status: 200 });
    }
    console.log('[dispatch] job row exists (QUEUED), running handler', {
      job_id: data.job_id,
      job_type: data.job_type,
    });
  } else {
    console.log('[dispatch] creating QUEUED row (replay or out-of-band push)', {
      job_id: data.job_id,
      job_type: data.job_type,
    });
    await jobs.dbCreateJob({
      id: data.job_id,
      job_type: data.job_type,
      payload: data.payload,
      status: JobStatus.QUEUED,
      follow_on: data.follow_on,
      invoked_by_id: data.invoked_by_id,
      activity_type: data.activity_type,
    });
  }

  // Create StorageBackend if needed
  const coreJobsRequiringStorage = [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH];
  const extensionJobsRequiringStorage = extensionJobs
    .filter((j) => j.requiresStorageBackend)
    .map((j) => j.jobType);
  const jobsRequiringStorage = [...coreJobsRequiringStorage, ...extensionJobsRequiringStorage];

  const storageBackend = jobsRequiringStorage.includes(data.job_type)
    ? new StorageBackend(ctx, [KnownBuckets.pub, KnownBuckets.prv])
    : undefined;

  console.log('[dispatch] invoking handler', {
    job_id: data.job_id,
    job_type: data.job_type,
    needs_storage: Boolean(storageBackend),
  });

  // Run handler
  try {
    const dbo = await handlers[data.job_type](
      ctx,
      {
        id: data.job_id,
        job_type: data.job_type,
        payload: data.payload,
        follow_on: data.follow_on,
        invoked_by_id: data.invoked_by_id,
        activity_type: data.activity_type,
        activity_data: data.activity_data,
      },
      storageBackend,
    );

    console.log('[dispatch] handler returned', {
      job_id: data.job_id,
      job_type: data.job_type,
      dbo_status: dbo?.status,
    });

    // Create work activity if activity_type is set
    const workVersionId = data.payload?.work_version_id;
    if (data.activity_type && data.invoked_by_id && typeof workVersionId === 'string') {
      try {
        const wv = await prisma.workVersion.findUnique({
          where: { id: workVersionId },
          select: { work_id: true },
        });
        if (wv) {
          await createWorkActivity({
            workId: wv.work_id,
            workVersionId,
            activityById: data.invoked_by_id,
            activityType: data.activity_type as 'CONVERTER_TASK_STARTED' | 'CHECK_STARTED',
            data: data.activity_data ?? undefined,
          });
        }
      } catch (err) {
        console.error('[dispatch] Failed to create work activity', data.activity_type, err);
      }
    }

    // Check for follow-on: if handler completed synchronously (COMPLETED) and follow_on exists
    if (dbo?.status === JobStatus.COMPLETED && data.follow_on?.on_success) {
      const fo = data.follow_on.on_success;
      try {
        const followOnId = fo.id ?? uuidv7();
        await jobs.dispatchAJob({
          job_id: followOnId,
          job_type: fo.job_type,
          payload: fo.payload,
          invoked_by_id: data.invoked_by_id,
          activity_type: fo.activity_type,
          activity_data: fo.activity_data,
        });
        console.log('[dispatch] dispatched follow-on job', {
          parent_job_id: data.job_id,
          follow_on_job_id: followOnId,
          follow_on_job_type: fo.job_type,
        });
      } catch (err) {
        console.error('[dispatch] Failed to dispatch follow-on job', err);
      }
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error(`[dispatch] Handler failed for ${data.job_type}:`, err);

    // Check if this is a transient error we should retry
    const isTransient =
      errMessage.includes('ECONNREFUSED') ||
      errMessage.includes('ETIMEDOUT') ||
      errMessage.includes('503') ||
      errMessage.includes('429');

    if (isTransient) {
      console.warn('[dispatch] transient handler error, returning 500 for Pub/Sub retry', {
        job_id: data.job_id,
        job_type: data.job_type,
        errMessage,
      });
      // Return 500 to trigger Pub/Sub retry
      return new Response(JSON.stringify({ error: errMessage }), { status: 500 });
    }

    // Permanent error: mark job as FAILED and ack
    try {
      await jobs.dbUpdateJob(data.job_id, {
        status: JobStatus.FAILED,
        message: `Handler failed: ${errMessage}`,
      });
    } catch (updateErr) {
      console.error('[dispatch] Failed to mark job as FAILED', updateErr);
    }
  }

  // Ack the message
  console.log('[dispatch] ack 200', { job_id: data.job_id, job_type: data.job_type });
  return new Response(null, { status: 200 });
}
