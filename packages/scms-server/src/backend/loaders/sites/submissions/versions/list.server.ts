import type { Prisma } from '@curvenote/scms-db';
import type { SubmissionVersionListingDTO } from '@curvenote/common';
import { getPrismaClient } from '../../../../prisma.server.js';
import type { SiteContext } from '../../../../context.site.server.js';
import { error404, makePaginationLinks } from '@curvenote/scms-core';
import { formatSubmissionVersionDTO } from './get.server.js';
import type { ModifiedSubmissionVersionDTO } from '../../../previews/get.server.js';

async function dbCountSubmissionVersions(
  siteName: string,
  submissionId: string,
  tx?: Prisma.TransactionClient,
) {
  const prisma = await getPrismaClient();
  const count = await (tx ?? prisma).submissionVersion.count({
    where: {
      submission: {
        id: submissionId,
        site: { is: { name: siteName } },
      },
    },
  });

  return count;
}

async function dbQuerySubmissionVersions(
  siteName: string,
  submissionId: string,
  opts?: { page?: number; limit?: number },
  tx?: Prisma.TransactionClient,
) {
  const skip = opts?.limit ? (opts?.page ?? 0) * opts?.limit : undefined;
  const take = opts?.limit;
  const prisma = await getPrismaClient();
  return (tx ?? prisma).submissionVersion.findMany({
    skip,
    take,
    where: {
      submission: {
        site: { is: { name: siteName } },
        id: submissionId,
      },
    },
    include: {
      submission: {
        include: {
          kind: true,
          collection: true,
          submitted_by: true,
          slugs: true,
          work: true,
        },
      },
      submitted_by: true,
      work_version: {
        include: {
          work: true,
        },
      },
    },
    orderBy: [
      {
        date_created: 'desc',
      },
    ],
  });
}

export async function dbListSubmissionVersions(
  ctx: SiteContext,
  submissionId: string,
  opts?: { page?: number; limit?: number },
) {
  if (!opts?.limit) {
    const items = await dbQuerySubmissionVersions(ctx.site.name, submissionId);
    return { items, total: items.length };
  }
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const items = await dbQuerySubmissionVersions(ctx.site.name, submissionId, opts, tx);
    const total = await dbCountSubmissionVersions(ctx.site.name, submissionId, tx);
    return { items, total };
  });
}

export type DBO = Exclude<Awaited<ReturnType<typeof dbListSubmissionVersions>>, null>;

export function formatSubmissionVersionListingDTO(
  ctx: SiteContext,
  submissionId: string,
  dbo: DBO,
  opts?: { page?: number; limit?: number },
): Omit<SubmissionVersionListingDTO, 'items'> & { items: ModifiedSubmissionVersionDTO[] } {
  const selfUrl = new URL(
    ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${submissionId}/versions`),
  );

  const links = makePaginationLinks(
    {
      self: selfUrl.toString(),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
      submission: ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${submissionId}`),
    },
    dbo.total,
    opts ?? {},
  );

  return {
    items: dbo.items.map((v: DBO['items'][0]) => {
      return formatSubmissionVersionDTO(ctx, v);
    }),
    total: dbo.total,
    links,
  };
}

export default async function (
  ctx: SiteContext,
  submissionId: string,
  opts?: { page?: number; limit?: number },
) {
  const dbo = await dbListSubmissionVersions(ctx, submissionId, opts);
  if (!dbo) throw error404();
  return formatSubmissionVersionListingDTO(ctx, submissionId, dbo, opts);
}
