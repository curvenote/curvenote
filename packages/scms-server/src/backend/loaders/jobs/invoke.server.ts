import type { Context } from '../../context.server.js';
import { httpError, KnownJobTypes } from '@curvenote/scms-core';
import { formatJobDTO } from './get.server.js';
import type { CreateJob, JobRegistration } from '@curvenote/scms-core';
import { getHandlers } from './handlers/index.js';
import { StorageBackend } from '../../storage/index.js';
import { KnownBuckets } from '../../storage/constants.server.js';
import { createWorkActivity } from '../../db.server.js';
import { getPrismaClient } from '../../prisma.server.js';

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
  if (!dbo) throw httpError(422, 'Unable to invoke job handler');

  // Optional: create a work-scoped activity when activity_type is set (work_version_id + user from context).
  const workVersionId = data.payload?.work_version_id;
  if (data.activity_type && ctx.user?.id && typeof workVersionId === 'string') {
    try {
      const prisma = await getPrismaClient();
      const wv = await prisma.workVersion.findUnique({
        where: { id: workVersionId },
        select: { work_id: true },
      });
      if (wv) {
        await createWorkActivity({
          workId: wv.work_id,
          workVersionId,
          activityById: ctx.user.id,
          activityType: data.activity_type as 'EXPORT_TO_PDF_STARTED' | 'CHECK_STARTED',
          data: data.activity_data ?? undefined,
        });
      }
    } catch (err) {
      console.error('Failed to create work activity after job invoke', data.activity_type, err);
    }
  }

  return formatJobDTO(ctx, dbo);
}
