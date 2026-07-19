import { getConfig } from '../../../app-config.server.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { sendJobMessage } from './pgmq/jobQueue.server.js';
import type { JobQueueMessage, JobQueueSendResult } from './pgmq/types.js';

const HANDSHAKE_EXPIRY_SECONDS = 4 * 60 * 60;

/**
 * Enqueue a job message onto the pgmq job queue.
 *
 * The drain wake is fired by Postgres itself — a pg_net AFTER INSERT trigger on
 * pgmq.q_job calls POST /v1/jobs/push-to-drain (migration 20260616190000), with
 * pg_cron as a 30-second backup — so the app does not self-call
 * push-to-drain after enqueue.
 */
export async function dispatchJob(message: JobQueueMessage) {
  return sendJobMessage(message, { idempotencyKey: message.job_id });
}

/**
 * Mint a fresh handshake token for a job and dispatch it. Shared by every
 * enqueue/promote path (enqueueAndDispatchJob, promoteAndDispatchJob,
 * promoteScheduledJobs) — they all need the same mint-then-dispatch sequence
 * with the same expiry.
 */
export async function dispatchJobWithHandshake(job: {
  id: string;
  job_type: string;
}): Promise<JobQueueSendResult> {
  const config = await getConfig();
  const handshake = createHandshakeToken(
    job.id,
    job.job_type,
    config.api.handshakeIssuer,
    config.api.handshakeSigningSecret,
    Math.floor(Date.now() / 1000) + HANDSHAKE_EXPIRY_SECONDS,
  );
  return dispatchJob({ job_id: job.id, job_type: job.job_type, handshake });
}
