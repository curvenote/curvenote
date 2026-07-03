import { JobStatus, Prisma } from '@curvenote/scms-db';
import pLimit from 'p-limit';
import { getPrismaClient } from '../../prisma.server.js';
import { dispatchJobWithHandshake } from './dispatchJob.server.js';

const DEFAULT_PROMOTE_LIMIT = 100;
/** Below getPrismaClient pool max (5) so dispatches don't hit connectionTimeoutMillis. */
const DISPATCH_CONCURRENCY = 4;

async function revertPromotedJobToScheduled(jobId: string, nowIso: string): Promise<void> {
  const prisma = await getPrismaClient();
  await prisma.job.updateMany({
    where: { id: jobId, status: JobStatus.QUEUED },
    data: { status: JobStatus.SCHEDULED, date_modified: nowIso },
  });
}

/**
 * Claim due SCHEDULED jobs, promote to QUEUED, and dispatch to pgmq.
 * On dispatch failure the row is reverted to SCHEDULED so the next sweep can retry.
 */
export async function promoteScheduledJobs(limit = DEFAULT_PROMOTE_LIMIT): Promise<{
  claimed: number;
  dispatched: number;
  dispatchFailed: number;
}> {
  const prisma = await getPrismaClient();
  const nowIso = new Date().toISOString();

  const promoted = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; job_type: string }[]>(
      Prisma.sql`
        UPDATE "Job"
        SET status = 'QUEUED'::"JobStatus", date_modified = ${nowIso}
        WHERE id IN (
          SELECT id FROM "Job"
          WHERE status = 'SCHEDULED'::"JobStatus"
            AND scheduled_at IS NOT NULL
            AND scheduled_at <= ${nowIso}
          ORDER BY scheduled_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, job_type
      `,
    );
    return rows;
  });

  // Each row is an independent job with its own pgmq idempotency key, so
  // dispatch concurrently (bounded to DISPATCH_CONCURRENCY); a failure only
  // reverts its own row and never affects the others. allSettled (not all):
  // the per-row handler already catches dispatch failures, but a fulfilled/
  // rejected split still protects the aggregation below if the revert itself
  // ever throws unexpectedly.
  const dispatchLimit = pLimit(DISPATCH_CONCURRENCY);
  const results = await Promise.allSettled(
    promoted.map((row) =>
      dispatchLimit(async () => {
        try {
          await dispatchJobWithHandshake(row);
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[promoteScheduledJobs] dispatch failed; reverting to SCHEDULED', {
            job_id: row.id,
            job_type: row.job_type,
            error: message,
          });
          await revertPromotedJobToScheduled(row.id, nowIso);
          return false;
        }
      }),
    ),
  );
  const dispatched = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const dispatchFailed = results.length - dispatched;

  console.log('[promoteScheduledJobs] done', {
    claimed: promoted.length,
    dispatched,
    dispatchFailed,
  });
  return { claimed: promoted.length, dispatched, dispatchFailed };
}
