import type { Context } from '../../context.server.js';
import { formatJobDTO } from './get.server.js';
import { error404 } from '@curvenote/scms-core';
import type { JobRegistration, UpdateJob } from '@curvenote/scms-core';
import { dbUpdateJob } from './handlers/db.server.js';
import invoke from './invoke.server.js';
import { triggerFollowOn } from './trigger-follow-on.server.js';

export default async function (
  ctx: Context,
  jobId: string,
  data: UpdateJob,
  extensionJobs?: JobRegistration[],
) {
  const dbo = await dbUpdateJob(jobId, data);
  if (!dbo) throw error404();

  if (dbo.status === 'COMPLETED' && extensionJobs != null) {
    const createJobFn = (c: Context, d: Parameters<typeof invoke>[1]) =>
      invoke(c, d, extensionJobs);
    await triggerFollowOn(ctx, jobId, createJobFn);
  }

  return formatJobDTO(ctx, dbo);
}
