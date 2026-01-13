import type { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../prisma.server.js';
import type { SubmissionKindListingDTO } from '@curvenote/common';
import type { SiteContext } from '../../../context.site.server.js';
import { formatSubmissionKindDTO } from './get.server.js';

export async function dbGetKinds(siteName: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionKind.findMany({
    where: {
      site: {
        is: {
          name: siteName,
          external: false,
        },
      },
    },
  });
}

export type DBO = Exclude<Prisma.PromiseReturnType<typeof dbGetKinds>, null>;

function formatSubmissionKindListingDTO(ctx: SiteContext, dbo: DBO): SubmissionKindListingDTO {
  return {
    items: dbo.map((item) => formatSubmissionKindDTO(ctx, item)),
    links: {
      self: ctx.asApiUrl(`/sites/${ctx.site.name}/kinds`),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
      submission_cdn: ctx.asApiUrl(`/sites/${ctx.site.name}/kinds.json`),
    },
  };
}

export default async function (ctx: SiteContext) {
  const dbo = await dbGetKinds(ctx.site.name);
  return formatSubmissionKindListingDTO(ctx, dbo);
}
