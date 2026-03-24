import { getPrismaClient, jobs } from '@curvenote/scms-server';
import { JobStatus } from '@curvenote/scms-db';

type DispatchJobParams = Parameters<typeof jobs.dispatchAJob>[0];

/**
 * POST /v1/jobs/dispatch-dlq
 *
 * Receives dead letter messages from the scmsJobDispatch-deadletter topic.
 * These are messages that failed to be processed after the maximum number
 * of delivery attempts on the main dispatch subscription.
 *
 * Creates or updates the job row as FAILED so the failure is visible in the system.
 * Always returns 200 (dead letters should always be acknowledged).
 */
export async function action({ request }: { request: Request }) {
  let data: DispatchJobParams | undefined;

  try {
    const body = await request.json();
    const message = (body as Record<string, any>)?.message;
    if (!message?.data) {
      console.error('[dispatch-dlq] Received message without data');
      return new Response(null, { status: 200 });
    }

    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    data = JSON.parse(decoded) as DispatchJobParams;
  } catch (err) {
    console.error('[dispatch-dlq] Failed to parse dead letter message', err);
    return new Response(null, { status: 200 });
  }

  if (!data?.job_id || !data?.job_type) {
    console.error('[dispatch-dlq] Dead letter missing job_id or job_type');
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
