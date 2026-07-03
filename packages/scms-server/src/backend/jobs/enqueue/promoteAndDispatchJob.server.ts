import { JobStatus } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
import { dispatchJobWithHandshake } from './dispatchJob.server.js';

/**
 * Promote a BLOCKED dependent job to QUEUED and dispatch it.
 * Idempotent if the row is already QUEUED or terminal.
 */
export async function promoteAndDispatchJob(jobId: string): Promise<void> {
  const prisma = await getPrismaClient();
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

  try {
    await dispatchJobWithHandshake(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[promoteAndDispatchJob] dispatch failed; reverting to BLOCKED', {
      job_id: jobId,
      job_type: job.job_type,
      error: message,
    });
    await prisma.job.updateMany({
      where: { id: jobId, status: JobStatus.QUEUED },
      data: { status: JobStatus.BLOCKED },
    });
    return;
  }

  console.log('[promoteAndDispatchJob] promoted and dispatched', {
    job_id: jobId,
    job_type: job.job_type,
  });
}
