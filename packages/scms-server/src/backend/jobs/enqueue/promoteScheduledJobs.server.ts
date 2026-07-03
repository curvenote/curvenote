import { JobStatus, Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
import { dispatchJobWithHandshake } from './dispatchJob.server.js';

const DEFAULT_PROMOTE_LIMIT = 100;

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

  let dispatched = 0;
  let dispatchFailed = 0;

  for (const row of promoted) {
    try {
      await dispatchJobWithHandshake(row);
      dispatched += 1;
    } catch (err) {
      dispatchFailed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[promoteScheduledJobs] dispatch failed; reverting to SCHEDULED', {
        job_id: row.id,
        job_type: row.job_type,
        error: message,
      });
      await revertPromotedJobToScheduled(row.id, nowIso);
    }
  }

  console.log('[promoteScheduledJobs] done', {
    claimed: promoted.length,
    dispatched,
    dispatchFailed,
  });
  return { claimed: promoted.length, dispatched, dispatchFailed };
}
