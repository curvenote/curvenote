import type { Context } from '../../context.server.js';
import { httpError, KnownJobTypes } from '@curvenote/scms-core';
import { formatJobDTO } from './get.server.js';
import type { CreateJob, JobRegistration, ServerExtension } from '@curvenote/scms-core';
import { getHandlers } from './handlers/index.js';
import { StorageBackend } from '../../storage/index.js';
import { KnownBuckets } from '../../storage/constants.server.js';
import { registerExtensionJobs } from '../../../modules/extensions/jobs.js';

export default async function (ctx: Context, data: CreateJob, extensionJobs: JobRegistration[]) {
  const { job_type } = data;
  const handlers = getHandlers(extensionJobs);

  if (!Object.keys(handlers).includes(job_type))
    throw httpError(400, `Unknown job type ${job_type}`);

  // Only create storage backend for jobs that need it
  const coreJobsRequiringStorage = [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH];
  // const extensionJobs = registerExtensionJobs(extensions);
  const extensionJobsRequiringStorage = extensionJobs
    .filter((job) => job.requiresStorageBackend)
    .map((job) => job.jobType);
  const jobsRequiringStorage = [...coreJobsRequiringStorage, ...extensionJobsRequiringStorage];

  const storageBackend = jobsRequiringStorage.includes(job_type)
    ? new StorageBackend(ctx, [KnownBuckets.pub, KnownBuckets.prv])
    : undefined;

  const dbo = await handlers[job_type](ctx, data, storageBackend);
  if (!dbo) throw httpError(422, 'Unable to create job');
  return formatJobDTO(ctx, dbo);
}
