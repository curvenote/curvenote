import { JobStatus } from '@curvenote/scms-db';
import { getConfig } from '../../../app-config.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { createHandshakeToken } from '../../sign.handshake.server.js';
import { dispatchJob } from './dispatchJob.server.js';

const HANDSHAKE_EXPIRY_SECONDS = 4 * 60 * 60;

/**
 * Promote a BLOCKED dependent job to QUEUED and dispatch it.
 * Idempotent if the row is already QUEUED or terminal.
 */
export async function promoteAndDispatchJob(jobId: string): Promise<void> {
  const prisma = await getPrismaClient();
  const config = await getConfig();
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    console.warn('[promoteAndDispatchJob] job not found', { job_id: jobId });
    return;
  }

  if (job.status !== JobStatus.BLOCKED) {
    console.log('[promoteAndDispatchJob] skip — not BLOCKED', {
      job_id: jobId,
      status: job.status,
    });
    return;
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.QUEUED },
  });

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

  console.log('[promoteAndDispatchJob] promoted and dispatched', {
    job_id: jobId,
    job_type: job.job_type,
  });
}
