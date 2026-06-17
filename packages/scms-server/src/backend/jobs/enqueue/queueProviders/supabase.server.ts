import { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../prisma.server.js';
import type {
  JobQueueMessage,
  JobQueueProvider,
  JobQueueSendOptions,
  JobQueueSendResult,
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
  async send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult> {
    const prisma = await getPrismaClient();
    const rows = await prisma.$queryRaw<Array<{ send: bigint }>>(
      Prisma.sql`SELECT pgmq.send(${PGMQ_JOB_QUEUE_NAME}, ${message}::jsonb) AS send`,
    );
    const msgId = rows[0]?.send;
    return { messageId: msgId != null ? String(msgId) : options.idempotencyKey };
  },

  readOne: readOneFromPgmq,

  async ack(receipt: QueueReadReceipt): Promise<void> {
    await deleteFromPgmq(receipt);
  },

  async nack(_receipt: QueueReadReceipt): Promise<void> {
    // Message becomes visible again after visibility timeout; read_ct increments on next read.
  },

  getDepth: getPgmqDepth,
};
