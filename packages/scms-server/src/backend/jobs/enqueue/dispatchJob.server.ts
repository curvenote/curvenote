import { sendJobMessage } from './pgmq/jobQueue.server.js';
import type { JobQueueMessage } from './pgmq/types.js';

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
