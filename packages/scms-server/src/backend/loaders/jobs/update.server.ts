import type { Context } from '../../context.server.js';
import { formatJobDTO } from './get.server.js';
import { error404 } from '@curvenote/scms-core';
import type { JobRegistration, UpdateJob } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { dbUpdateJob } from '../../jobs/handlers/db.server.js';
import { onJobTerminal } from '../../jobs/run/onJobTerminal.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { recordConverterTaskTerminalActivity } from './recordConverterTaskTerminalActivity.server.js';

type TerminalStatus =
  typeof JobStatus.COMPLETED | typeof JobStatus.FAILED | typeof JobStatus.CANCELLED;

function isTerminalStatus(status: string): status is TerminalStatus {
  return (
    status === JobStatus.COMPLETED || status === JobStatus.FAILED || status === JobStatus.CANCELLED
  );
}

export default async function (
  ctx: Context,
  jobId: string,
  data: UpdateJob,
  extensionJobs?: JobRegistration[],
) {
  const prisma = await getPrismaClient();
  const prior = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true, job_type: true },
  });
  if (!prior) throw error404();

  const dbo = await dbUpdateJob(jobId, data);
  if (!dbo) throw error404();

  const registration = (extensionJobs ?? []).find((j) => j.jobType === dbo.job_type);
  if (registration?.onJobPatch) {
    try {
      await registration.onJobPatch({
        ctx,
        job: {
          id: dbo.id,
          job_type: dbo.job_type,
          status: dbo.status,
          payload: dbo.payload,
          results: dbo.results,
          messages: dbo.messages,
        },
        priorStatus: prior.status,
        update: data,
      });
    } catch (err) {
      console.error('[jobs.update] onJobPatch failed', {
        jobId,
        job_type: dbo.job_type,
        err,
      });
      throw err;
    }
  }

  if (isTerminalStatus(dbo.status) && !isTerminalStatus(prior.status)) {
    await onJobTerminal(jobId, dbo.status);
    await recordConverterTaskTerminalActivity(dbo, dbo.status);
  }

  return formatJobDTO(ctx, dbo);
}
