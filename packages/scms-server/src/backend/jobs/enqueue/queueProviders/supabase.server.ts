import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../prisma.server.js';
import type {
  JobQueueMessage,
  JobQueueProvider,
  JobQueueSendOptions,
  JobQueueSendResult,
  QueuePeekEntry,
  QueueReadReceipt,
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

async function readOneFromPgmq(): Promise<QueueReadResult | null> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<PgmqReadRow[]>(
    Prisma.sql`SELECT msg_id, read_ct, message FROM pgmq.read(${PGMQ_JOB_QUEUE_NAME}, ${PGMQ_VISIBILITY_TIMEOUT_SECONDS}, 1)`,
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0]!;
  return {
    message: row.message,
    metadata: {
      deliveryCount: row.read_ct,
      messageId: String(row.msg_id),
    },
    receipt: row.msg_id,
  };
}

async function deleteFromPgmq(receipt: QueueReadReceipt): Promise<void> {
  const msgId = receipt as bigint;
  const prisma = await getPrismaClient();
  await prisma.$executeRaw(
    Prisma.sql`SELECT pgmq.delete(${PGMQ_JOB_QUEUE_NAME}, ${msgId}::bigint)`,
  );
}

type PgmqQueueRow = {
  msg_id: bigint;
  read_ct: number;
  enqueued_at: Date | null;
  vt: Date | null;
  message: JobQueueMessage;
  in_flight: boolean;
};

async function peekPgmq(limit: number): Promise<QueuePeekEntry[]> {
  const prisma = await getPrismaClient();
  // Read directly from the pgmq queue table (q_<queue>) so in-flight/unacked
  // messages (vt in the future) are visible without consuming them.
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

async function getPgmqDepth(): Promise<number> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<PgmqMetricsRow[]>(
    Prisma.sql`SELECT queue_name, queue_length, newest_msg_age_sec, oldest_msg_age_sec, total_messages FROM pgmq.metrics(${PGMQ_JOB_QUEUE_NAME})`,
  );
  if (rows.length === 0) {
    return 0;
  }
  return Number(rows[0]!.queue_length);
}

export const supabaseQueueProvider: JobQueueProvider = {
  // A pg_net trigger on pgmq.q_job (migration 20260617120000) fires the enqueue
  // wake from Postgres, so dispatchJob does not self-call push-to-drain.
  wakesOnEnqueue: true,

  async send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult> {
    const prisma = await getPrismaClient();
    // Honor idempotencyKey (the job_id). pgmq has no native idempotency, so skip
    // the enqueue when a message for the same job is already pending or in-flight
    // in pgmq.q_job. Without this, a retried enqueue (e.g. a client retry of
    // POST /v1/jobs with the same id, where ensureJobRow already skipped the
    // insert) would add a second message and two drains could run the same job
    // concurrently. A transaction-scoped advisory lock keyed on the job id
    // serializes concurrent sends for the same job, making the check-then-insert
    // atomic; different jobs hash to different keys and never contend.
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
      console.log('[supabase-queue] skipping duplicate enqueue; job already in queue', {
        job_id: message.job_id,
        idempotencyKey: options.idempotencyKey,
        existingMessageId: existingId != null ? String(existingId) : null,
      });
      return { messageId: existingId != null ? String(existingId) : options.idempotencyKey };
    });
  },

  readOne: readOneFromPgmq,

  async ack(receipt: QueueReadReceipt): Promise<void> {
    await deleteFromPgmq(receipt);
  },

  async nack(_receipt: QueueReadReceipt): Promise<void> {
    // Message becomes visible again after visibility timeout; read_ct increments on next read.
  },

  getDepth: getPgmqDepth,

  peek: peekPgmq,
};
