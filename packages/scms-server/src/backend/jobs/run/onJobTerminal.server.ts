import { KnownJobTypes, type JobRegistration } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../prisma.server.js';
import { enqueueAndDispatchJob } from '../enqueue/enqueueAndDispatchJob.server.js';
import { promoteAndDispatchJob } from '../enqueue/promoteAndDispatchJob.server.js';
import { lastJobMessage } from './jobMessages.server.js';

export type OnJobTerminalOptions = {
  extensionJobs?: JobRegistration[];
  /** Suppress JOB_FAILED_DEFAULT when cascading cancellation through dependent chains. */
  skipFailedDefault?: boolean;
};

type ParentTerminalStatus =
  | typeof JobStatus.COMPLETED
  | typeof JobStatus.FAILED
  | typeof JobStatus.CANCELLED;

/**
 * When a parent job reaches a terminal status, promote or cancel BLOCKED dependents.
 * Enqueues JOB_FAILED_DEFAULT when parent FAILED or CANCELLED with no failure dependents.
 */
export async function onJobTerminal(
  parentJobId: string,
  status: ParentTerminalStatus,
  options?: OnJobTerminalOptions,
): Promise<void> {
  const prisma = await getPrismaClient();
  const parent = await prisma.job.findUnique({ where: { id: parentJobId } });
  if (!parent) return;

  const blockedDependents = await prisma.job.findMany({
    where: {
      depends_on_job_id: parentJobId,
      status: JobStatus.BLOCKED,
    },
  });

  async function cancelDependent(depId: string): Promise<void> {
    await prisma.job.update({
      where: { id: depId },
      data: { status: JobStatus.CANCELLED },
    });
    await onJobTerminal(depId, JobStatus.CANCELLED, { skipFailedDefault: true });
  }

  if (status === JobStatus.COMPLETED) {
    for (const dep of blockedDependents) {
      if (dep.trigger_on === 'SUCCESS') {
        await promoteAndDispatchJob(dep.id);
      } else if (dep.trigger_on === 'FAILURE') {
        await cancelDependent(dep.id);
      }
    }
    return;
  }

  // Parent FAILED or CANCELLED — failure-path dependents run; success-path dependents are dropped.
  let promotedFailureDependent = false;
  for (const dep of blockedDependents) {
    if (dep.trigger_on === 'FAILURE') {
      await promoteAndDispatchJob(dep.id);
      promotedFailureDependent = true;
    } else if (dep.trigger_on === 'SUCCESS') {
      await cancelDependent(dep.id);
    }
  }

  if (
    !options?.skipFailedDefault &&
    !promotedFailureDependent &&
    parent.job_type !== KnownJobTypes.JOB_FAILED_DEFAULT
  ) {
    const failedParent = await prisma.job.findUnique({ where: { id: parentJobId } });
    const lastError = lastJobMessage(failedParent?.messages);
    const cleanupJobId = uuidv7();
    await enqueueAndDispatchJob({
      job_id: cleanupJobId,
      job_type: KnownJobTypes.JOB_FAILED_DEFAULT,
      payload: {
        failed_job_id: parentJobId,
        failed_job_type: failedParent?.job_type ?? parent.job_type,
        reason: 'domain_failed',
        source: 'on_failure_fallback',
        last_error: lastError,
      },
      invoked_by_id: failedParent?.invoked_by_id ?? parent.invoked_by_id ?? undefined,
    });
  }
}
