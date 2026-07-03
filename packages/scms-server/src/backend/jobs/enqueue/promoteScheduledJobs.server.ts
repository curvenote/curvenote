import { JobStatus, Prisma } from '@curvenote/scms-db';
import { getConfig } from '../../../app-config.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { dispatchJob } from './dispatchJob.server.js';

const HANDSHAKE_EXPIRY_SECONDS = 4 * 60 * 60;
const DEFAULT_PROMOTE_LIMIT = 100;

async function dispatchPromotedJob(job: { id: string; job_type: string }): Promise<void> {
  const config = await getConfig();
  const handshake = createHandshakeToken(
    job.id,
    job.job_type,
    config.api.handshakeIssuer,
    config.api.handshakeSigningSecret,
    Math.floor(Date.now() / 1000) + HANDSHAKE_EXPIRY_SECONDS,
  );
  await dispatchJob({
    job_id: job.id,
    job_type: job.job_type,
    handshake,
  });
}

/**
 * Claim due SCHEDULED jobs, promote to QUEUED, and dispatch to pgmq.
 */
export async function promoteScheduledJobs(limit = DEFAULT_PROMOTE_LIMIT): Promise<{
  promoted: number;
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

  for (const row of promoted) {
    await dispatchPromotedJob(row);
  }

  console.log('[promoteScheduledJobs] promoted', { count: promoted.length });
  return { promoted: promoted.length };
}

export { dispatchPromotedJob };
