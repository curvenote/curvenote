import { getPrismaClient, jobs, verifyHandshakeToken, withContext } from '@curvenote/scms-server';
import { JobStatus } from '@curvenote/scms-db';
import { markPermanentDispatchFailure, tryParsePubSubMessage } from './utils.server';

/**
 * POST /v1/jobs/dispatch/dlq
 *
 * Receives dead letter messages from the scmsJobDispatch-deadletter topic.
 * These are messages that failed to be processed after the maximum number
 * of delivery attempts on the main dispatch subscription.
 *
 * Auth: same as /v1/jobs/dispatch — handshake JWT in message attributes; jobId must match data.
 *
 * Creates or updates the job row as FAILED so the failure is visible in the system.
 * Always returns 200 (dead letters should always be acknowledged).
 */
export async function action({ request, context }: { request: Request; context?: any }) {
  const args = { request, context, params: {} };
  const ctx = await withContext(args as any, { noTokens: true });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error('[dispatch-dlq] Request body is not valid JSON');
    return new Response(null, { status: 200 });
  }

  const parsed = tryParsePubSubMessage(body);
  if (!parsed.ok) {
    await markPermanentDispatchFailure(parsed.reason, parsed.salvage, '[dispatch-dlq]');
    return new Response(null, { status: 200 });
  }
  const { data, attributes } = parsed;

  let claims: { jobId: string };
  try {
    claims = verifyHandshakeToken(
      attributes.handshake,
      ctx.$config.api.handshakeIssuer,
      ctx.$config.api.handshakeSigningSecret,
    );
  } catch {
    await markPermanentDispatchFailure(
      'Invalid handshake token',
      {
        job_id: data.job_id,
        job_type: data.job_type,
        payload: data.payload,
        invoked_by_id: data.invoked_by_id,
      },
      '[dispatch-dlq]',
    );
    return new Response(null, { status: 200 });
  }
  if (claims.jobId !== data.job_id) {
    await markPermanentDispatchFailure(
      'Handshake jobId does not match message job_id',
      {
        job_id: data.job_id,
        job_type: data.job_type,
        payload: data.payload,
        invoked_by_id: data.invoked_by_id,
      },
      '[dispatch-dlq]',
    );
    return new Response(null, { status: 200 });
  }

  console.error(
    `[dispatch-dlq] Job ${data.job_id} (${data.job_type}) failed after max delivery attempts`,
  );

  try {
    const prisma = await getPrismaClient();
    const existing = await prisma.job.findUnique({ where: { id: data.job_id } });

    if (existing) {
      // Only update if not already in a terminal state
      if (existing.status !== JobStatus.COMPLETED && existing.status !== JobStatus.FAILED) {
        await jobs.dbUpdateJob(data.job_id, {
          status: JobStatus.FAILED,
          message: 'Job dispatch failed after maximum delivery attempts (dead letter)',
        });
      }
    } else {
      // Job row was never created — create it as FAILED
      await jobs.dbCreateJob({
        id: data.job_id,
        job_type: data.job_type,
        payload: data.payload ?? {},
        status: JobStatus.FAILED,
        message: 'Job dispatch failed after maximum delivery attempts (dead letter)',
        invoked_by_id: data.invoked_by_id,
      });
    }
  } catch (err) {
    console.error('[dispatch-dlq] Failed to update/create job row', data.job_id, err);
  }

  // Always ack dead letters
  return new Response(null, { status: 200 });
}
