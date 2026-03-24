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
import { httpError, KnownJobTypes } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { extensions } from '../../extensions/server';

type DispatchJobParams = Parameters<typeof jobs.dispatchJob>[0];

// Extend Vercel timeout — handlers can be long-running (e.g. PUBLISH copies files)
export const config = {
  maxDuration: 300,
};

/**
 * Parse a Pub/Sub push message body.
 * Expected shape: { message: { attributes: { handshake, job_type }, data: "<base64>" } }
 */
function parsePubSubMessage(body: unknown): {
  data: DispatchJobParams;
  attributes: { handshake: string; job_type: string };
} {
  if (!body || typeof body !== 'object') throw httpError(400, 'Missing request body');
  const message = (body as Record<string, any>).message;
  if (!message || typeof message !== 'object') throw httpError(400, 'Missing message in body');

  const { attributes, data: dataBase64 } = message as Record<string, any>;
  if (!attributes?.handshake) throw httpError(400, 'Missing handshake in message attributes');
  if (!attributes?.job_type) throw httpError(400, 'Missing job_type in message attributes');
  if (!dataBase64 || typeof dataBase64 !== 'string') throw httpError(400, 'Missing message data');

  let data: DispatchJobParams;
  try {
    const decoded = Buffer.from(dataBase64, 'base64').toString('utf-8');
    data = JSON.parse(decoded) as DispatchJobParams;
  } catch {
    throw httpError(400, 'Message data is not valid base64 JSON');
  }

  if (!data.job_id || !data.job_type) {
    throw httpError(400, 'Message data must contain job_id and job_type');
  }

  return { data, attributes: { handshake: attributes.handshake, job_type: attributes.job_type } };
}

/**
 * POST /v1/jobs/dispatch
 *
 * Receives Pub/Sub push messages from the scmsJobDispatch topic.
 * Creates the DB row, resolves the handler, and runs it.
 *
 * Auth: handshake JWT in message attributes (signed by the publisher with
 * the same handshakeSigningSecret). The JWT's jobId must match the message data.
 *
 * Returns 200 to ack the message. Returns 500 for transient errors (Pub/Sub retries).
 * Permanent errors (bad payload, unknown job type) ack with 200 after marking the job FAILED.
 */
export async function action({ request, context }: { request: Request; context?: any }) {
  const args = { request, context, params: {} };
  const ctx = await withContext(args as any, { noTokens: true });

  const body = await request.json();
  const { data, attributes } = parsePubSubMessage(body);

  // Verify the handshake token
  const claims = verifyHandshakeToken(
    attributes.handshake,
    ctx.$config.api.handshakeIssuer,
    ctx.$config.api.handshakeSigningSecret,
  );
  if (claims.jobId !== data.job_id) {
    throw httpError(401, 'Handshake jobId does not match message job_id');
  }

  // Resolve handler
  const extensionJobs = registerExtensionJobs(extensions);
  const handlers = jobs.getHandlers(extensionJobs);
  if (!handlers[data.job_type]) {
    // Permanent error — unknown job type. Create FAILED row, ack the message.
    console.error(`[dispatch] Unknown job type: ${data.job_type}`);
    await jobs.dbCreateJob({
      id: data.job_id,
      job_type: data.job_type,
      payload: data.payload,
      status: JobStatus.FAILED,
      message: `Unknown job type: ${data.job_type}`,
      invoked_by_id: data.invoked_by_id,
    });
    return new Response(null, { status: 200 });
  }

  // Create DB row (QUEUED) — check for existing to handle retries
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: data.job_id } });
  if (existing) {
    // Retry scenario: row exists. If it's already past QUEUED, skip.
    if (existing.status !== JobStatus.QUEUED) {
      console.log(`[dispatch] Job ${data.job_id} already ${existing.status}, skipping`);
      return new Response(null, { status: 200 });
    }
  } else {
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
        await jobs.dispatchJob({
          job_id: fo.id ?? uuidv7(),
          job_type: fo.job_type,
          payload: fo.payload,
          invoked_by_id: data.invoked_by_id,
          activity_type: fo.activity_type,
          activity_data: fo.activity_data,
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
  return new Response(null, { status: 200 });
}
