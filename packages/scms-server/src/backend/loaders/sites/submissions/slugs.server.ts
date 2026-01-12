import type { Prisma } from '@prisma/client';
import { SlugStrategy } from '@prisma/client';
import type { SiteContext } from '../../../context.site.server.js';
import { userHasScope } from '../../../scopes.helpers.server.js';
import { error401, scopes } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';
import { uuidv7 } from 'uuidv7';
import { doi as doiUtils } from 'doi-utils';

async function dbCountSlugsForSubmission(submissionId: string) {
  const prisma = await getPrismaClient();
  return prisma.slug.count({
    where: {
      submission: {
        id: submissionId,
      },
    },
  });
}

async function dbCreateSlugForSubmission(
  ctx: SiteContext,
  slug: string,
  submissionId: string,
  tx?: Prisma.TransactionClient,
) {
  const timestamp = new Date().toISOString();
  const prisma = await getPrismaClient();
  return (tx ?? prisma).slug.create({
    data: {
      id: uuidv7(),
      slug,
      date_created: timestamp,
      date_modified: timestamp,
      primary: true,
      submission: {
        connect: {
          id: submissionId,
        },
      },
      site: {
        connect: {
          id: ctx.site.id,
        },
      },
    },
  });
}

export async function apply(
  ctx: SiteContext,
  submissionVersion: {
    submission: { id: string; work: { doi: string | null } | null };
    work_version: { doi: string | null };
  },
  tx?: Prisma.TransactionClient,
) {
  if (!ctx.user) return error401('Unauthorized - cannot update slug');
  if (!userHasScope(ctx.user, scopes.site.submissions.update, ctx.site.name))
    return error401('Unauthorized - cannot update slug');
  const doi = submissionVersion.work_version.doi ?? submissionVersion.submission.work?.doi;
  if (ctx.site.slug_strategy === SlugStrategy.NONE || doi == null) return null;
  const numSlugs = await dbCountSlugsForSubmission(submissionVersion.submission.id);
  if (numSlugs > 0) return null;

  const secondPartOfDoi = doiUtils.normalize(doi)?.split('https://doi.org/')[0].split('/')[1];
  if (!secondPartOfDoi) {
    console.debug('could not normalize doi for slug creation', doi);
    return null;
  }
  return dbCreateSlugForSubmission(ctx, secondPartOfDoi, submissionVersion.submission.id, tx);
}
