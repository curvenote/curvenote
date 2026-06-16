import type { Context } from '../../context.server.js';
import { formatJobDTO } from './get.server.js';
import { error404 } from '@curvenote/scms-core';
import type { JobRegistration, UpdateJob } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import { dbUpdateJob } from '../../jobs/handlers/db.server.js';
import { onJobTerminal } from '../../jobs/run/onJobTerminal.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { recordConverterTaskTerminalActivity } from './recordConverterTaskTerminalActivity.server.js';

type TerminalStatus = typeof JobStatus.COMPLETED | typeof JobStatus.FAILED;

function isTerminalStatus(status: string): status is TerminalStatus {
  return status === JobStatus.COMPLETED || status === JobStatus.FAILED;
}

export default async function (
  ctx: Context,
  jobId: string,
  data: UpdateJob,
  _extensionJobs?: JobRegistration[],
) {
  const prisma = await getPrismaClient();
  const prior = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  if (!prior) throw error404();

  const dbo = await dbUpdateJob(jobId, data);
  if (!dbo) throw error404();

  if (isTerminalStatus(dbo.status)) {
    await onJobTerminal(jobId, dbo.status);
    if (!isTerminalStatus(prior.status)) {
      await recordConverterTaskTerminalActivity(dbo, dbo.status);
    }
  }

  return formatJobDTO(ctx, dbo);
}
