import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../prisma.server.js';
import { MAX_JOB_QUEUE_DELIVERY_ATTEMPTS } from '../../jobQueueConstants.server.js';
import { handleTransportFailure } from '../../run/handleTransportFailure.server.js';
import type {
  JobQueueMessage,
  JobQueueSendOptions,
  JobQueueSendResult,
  QueuePeekEntry,
  QueueReadResult,
} from './types.js';

export const PGMQ_JOB_QUEUE_NAME = 'job';

/** Visibility timeout (seconds) — matches push-to-drain maxDuration. */
export const PGMQ_VISIBILITY_TIMEOUT_SECONDS = 300;

type PgmqReadRow = {
  msg_id: bigint;
  read_ct: number;
  message: JobQueueMessage;
};

type PgmqMetricsRow = {
  queue_name: string;
  queue_length: bigint;
  newest_msg_age_sec: number | null;
  oldest_msg_age_sec: number | null;
  total_messages: bigint;
};

type PgmqQueueRow = {
  msg_id: bigint;
  read_ct: number;
  enqueued_at: Date | null;
  vt: Date | null;
  message: JobQueueMessage;
  in_flight: boolean;
};

/**
 * Enqueue a job message, honoring the idempotency key (the job_id).
 *
 * pgmq has no native idempotency, so we skip the enqueue when a message for the
 * same job is already pending or in-flight in pgmq.q_job. Without this, a
 * retried enqueue (e.g. a client retry of POST /v1/jobs with the same id, where
 * ensureJobRow already skipped the insert) would add a second message and two
 * drains could run the same job concurrently. A transaction-scoped advisory
 * lock keyed on the job id serializes concurrent sends for the same job, making
 * the check-then-insert atomic; different jobs hash to different keys and never
 * contend.
 */
export async function sendJobMessage(
  message: JobQueueMessage,
  options: JobQueueSendOptions,
): Promise<JobQueueSendResult> {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${options.idempotencyKey}))`,
    );
    const rows = await tx.$queryRaw<Array<{ send: bigint }>>(
      Prisma.sql`SELECT pgmq.send(${PGMQ_JOB_QUEUE_NAME}, ${message}::jsonb) AS send
                 WHERE NOT EXISTS (
                   SELECT 1 FROM pgmq.q_job WHERE message ->> 'job_id' = ${options.idempotencyKey}
                 )`,
    );
    const msgId = rows[0]?.send;
    if (msgId != null) {
      return { messageId: String(msgId) };
    }

    // A message for this job is already queued/in-flight: return its id so the
    // caller still gets a stable handle, but do not enqueue a duplicate.
    const existing = await tx.$queryRaw<Array<{ msg_id: bigint }>>(
      Prisma.sql`SELECT msg_id FROM pgmq.q_job
                 WHERE message ->> 'job_id' = ${options.idempotencyKey}
                 ORDER BY msg_id ASC
                 LIMIT 1`,
    );
    const existingId = existing[0]?.msg_id;
    console.log('[pgmq-queue] skipping duplicate enqueue; job already in queue', {
      job_id: message.job_id,
      idempotencyKey: options.idempotencyKey,
      existingMessageId: existingId != null ? String(existingId) : null,
    });
    return { messageId: existingId != null ? String(existingId) : options.idempotencyKey };
  });
}

/**
 * Dead-letter a message that has exhausted its delivery attempts: archive it to
 * pgmq.a_job (forensics) and mark the job FAILED. Archiving removes the row from
 * the active queue so it is never re-delivered.
 */
async function deadLetterMessage(row: PgmqReadRow): Promise<void> {
  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`SELECT pgmq.archive(${PGMQ_JOB_QUEUE_NAME}, ${row.msg_id}::bigint)`,
  );
  console.error('[pgmq-queue] dead-lettering message after exhausted delivery attempts', {
    job_id: row.message?.job_id,
    job_type: row.message?.job_type,
    messageId: String(row.msg_id),
    readCount: row.read_ct,
    maxAttempts: MAX_JOB_QUEUE_DELIVERY_ATTEMPTS,
  });
  await handleTransportFailure(row.message.job_id, {
    reason: 'transport_exhausted',
    source: 'dead_letter',
    last_error: `Job dispatch failed after ${MAX_JOB_QUEUE_DELIVERY_ATTEMPTS} delivery attempts`,
  });
}

/**
 * Read and lease one message (qty=1, vt=300s). Messages whose read_ct has
 * exceeded MAX_JOB_QUEUE_DELIVERY_ATTEMPTS are dead-lettered here (archived +
 * job marked FAILED) and skipped, so a poison message can never block the queue
 * or be handed to the consumer indefinitely.
 */
export async function readOneJobMessage(): Promise<QueueReadResult | null> {
  const prisma = await getPrismaClient();
  // Loop to skip + dead-letter poison messages until we find a deliverable one
  // or the queue is empty. archive() removes the dead-lettered row, so the next
  // read returns a different message (no infinite loop).
  for (;;) {
    const rows = await prisma.$queryRaw<PgmqReadRow[]>(
      Prisma.sql`SELECT msg_id, read_ct, message FROM pgmq.read(${PGMQ_JOB_QUEUE_NAME}, ${PGMQ_VISIBILITY_TIMEOUT_SECONDS}, 1)`,
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0]!;
    // read_ct increments on each read. read_ct > MAX means the message has
    // already been delivered MAX times and still not acked — dead-letter it.
    if (row.read_ct > MAX_JOB_QUEUE_DELIVERY_ATTEMPTS) {
      await deadLetterMessage(row);
      continue;
    }

    return {
      message: row.message,
      metadata: {
        deliveryCount: row.read_ct,
        messageId: String(row.msg_id),
      },
      msgId: row.msg_id,
    };
  }
}

/** Acknowledge (delete) a successfully processed message. */
export async function ackJobMessage(msgId: bigint): Promise<void> {
  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`SELECT pgmq.delete(${PGMQ_JOB_QUEUE_NAME}, ${msgId}::bigint)`,
  );
}

/** Current queue depth (pending messages). */
export async function getJobQueueDepth(): Promise<number> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<PgmqMetricsRow[]>(
    Prisma.sql`SELECT queue_name, queue_length, newest_msg_age_sec, oldest_msg_age_sec, total_messages FROM pgmq.metrics(${PGMQ_JOB_QUEUE_NAME})`,
  );
  if (rows.length === 0) {
    return 0;
  }
  return Number(rows[0]!.queue_length);
}

/**
 * Read-only tail of the queue for admin/monitoring. Reads directly from the
 * pgmq queue table (q_job) so in-flight/unacked messages (vt in the future) are
 * visible without consuming them.
 */
export async function peekJobQueue(limit: number): Promise<QueuePeekEntry[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<PgmqQueueRow[]>(
    Prisma.sql`SELECT msg_id, read_ct, enqueued_at, vt, message, (vt > now()) AS in_flight
               FROM pgmq.q_job
               ORDER BY msg_id DESC
               LIMIT ${limit}`,
  );

  return rows.map((row) => ({
    messageId: String(row.msg_id),
    jobId: row.message?.job_id ?? 'unknown',
    jobType: row.message?.job_type ?? 'unknown',
    deliveryCount: row.read_ct,
    enqueuedAt: row.enqueued_at ? row.enqueued_at.toISOString() : null,
    visibleAt: row.vt ? row.vt.toISOString() : null,
    inFlight: row.in_flight,
  }));
}
