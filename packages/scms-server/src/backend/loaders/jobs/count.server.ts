import type { $Enums, Prisma } from '@curvenote/scms-db';
import type { Context } from '../../context.server.js';
import { getPrismaClient } from '../../prisma.server.js';

async function dbCountJobs(siteId: string, types: string[], statuses?: $Enums.JobStatus[]) {
  const where: Prisma.JobWhereInput = {
    job_type: {
      in: types,
    },
    payload: {
      path: ['site_id'],
      equals: siteId,
    },
  };

  if (statuses) {
    where.status = {
      in: statuses,
    };
  }

  const prisma = await getPrismaClient();
  return prisma.job.count({ where });
}

export default async function (
  ctx: Context,
  siteId: string,
  types: string[],
  statuses?: $Enums.JobStatus[],
) {
  return await dbCountJobs(siteId, types, statuses);
}
