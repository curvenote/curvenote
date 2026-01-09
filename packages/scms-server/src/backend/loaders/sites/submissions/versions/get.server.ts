import { formatDate } from '@curvenote/common';
import type { SubmissionVersionDTO } from '@curvenote/common';
import type { Prisma } from '@prisma/client';
import { signPrivateUrls } from '../../../../sign.private.server.js';
import type { SiteContext } from '../../../../context.site.server.js';
import { getPrismaClient } from '../../../../prisma.server.js';
import { coerceToObject, error404 } from '@curvenote/scms-core';
import type { ModifiedSiteWorkDTO } from '../published/get.server.js';
import { formatSiteWorkDTO } from '../published/get.server.js';
import { formatSubmissionKindSummaryDTO } from '../../kinds/get.server.js';
import type { WorkflowTransition } from '@curvenote/scms-core';

export async function dbGetSubmissionVersion(
  where: Prisma.SubmissionVersionFindUniqueArgs['where'],
) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findUnique({
    where,
    include: {
      submitted_by: true,
      work_version: {
        include: {
          work: true,
        },
      },
      submission: {
        include: {
          kind: true,
          collection: true,
          slugs: true,
          work: true,
        },
      },
    },
  });
}

type DBO = Exclude<Prisma.PromiseReturnType<typeof dbGetSubmissionVersion>, null>;

export function formatSubmissionVersionDTO(
  ctx: SiteContext,
  version: DBO,
): Omit<SubmissionVersionDTO, 'site_work'> & { site_work: ModifiedSiteWorkDTO } & {
  transition?: WorkflowTransition;
} {
  let thumbnail: string | undefined;
  if (version.work_version.cdn_key && version.work_version.cdn) {
    const { thumbnail: thumbnailUrl } = signPrivateUrls(
      ctx,
      { cdn: version.work_version.cdn, key: version.work_version.cdn_key },
      ctx.asApiUrl(
        `/sites/${ctx.site.name}/works/${version.work_version.work_id}/versions/${version.work_version_id}/thumbnail`,
      ),
      'no-social',
    );
    thumbnail = thumbnailUrl;
  }
  return {
    id: version.id,
    date_created: formatDate(version.date_created),
    date_published: version.date_published ?? undefined,
    status: version.status,
    transition: version.transition == null ? undefined : (version.transition as WorkflowTransition),
    submitted_by: {
      id: version.submitted_by.id,
      name: version.submitted_by.display_name ?? '',
    },
    submission_id: version.submission.id,
    site_name: ctx.site.name,
    site_work: formatSiteWorkDTO(ctx, { ...version, submission: version.submission }),
    kind: formatSubmissionKindSummaryDTO(version.submission.kind),
    collection: {
      ...version.submission.collection,
      content: coerceToObject(version.submission.collection.content),
    },
    job_id: version.job_id ?? undefined,
    links: {
      self: ctx.asApiUrl(
        `/sites/${ctx.site.name}/submissions/${version.submission.id}/versions/${version.id}`,
      ),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
      submission: ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${version.submission.id}`),
      work: ctx.asApiUrl(`/works/${version.work_version.work_id}`),
      thumbnail,
      build: version.job_id ? ctx.asBaseUrl(`/build/${version.job_id}`) : undefined,
    },
  };
}

export default async function (ctx: SiteContext, submissionVersionId: string) {
  const dbo = await dbGetSubmissionVersion({ id: submissionVersionId });
  if (!dbo) throw error404();
  return formatSubmissionVersionDTO(ctx, dbo);
}
