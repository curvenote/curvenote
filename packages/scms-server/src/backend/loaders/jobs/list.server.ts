import type { JobStatus, Prisma } from '@prisma/client';
import type { Context } from '../../context.server.js';
import { formatJobDTO } from './get.server.js';
import { getPrismaClient } from '../../prisma.server.js';

async function dbListJobs(
  siteId: string,
  types: string[],
  statuses?: JobStatus[],
  take?: number,
  skip?: number,
) {
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
  return prisma.job.findMany({
    where,
    orderBy: {
      date_created: 'desc',
    },
    take,
    skip,
  });
}

export default async function (
  ctx: Context,
  siteId: string,
  types: string[],
  statuses?: JobStatus[],
  take?: number,
  skip?: number,
) {
  const dbo = await dbListJobs(siteId, types, statuses, take, skip);
  if (!dbo) return { items: [] };
  return { items: dbo.map((j) => formatJobDTO(ctx, j)) };
}
