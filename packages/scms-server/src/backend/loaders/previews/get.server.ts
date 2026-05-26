import { getPrismaClient } from '../../prisma.server.js';
import { submissionVersionForSiteWorkSelect } from '../../prisma.selects.server.js';
import type { Prisma } from '@curvenote/scms-db';

/** Preview route only — extends site-work select with site graph for SiteContext. */
const submissionVersionForPreviewSelect = {
  ...submissionVersionForSiteWorkSelect,
  submission: {
    select: {
      id: true,
      date_published: true,
      kind: true,
      collection: true,
      slugs: true,
      work: true,
      site: {
        include: {
          submissionKinds: true,
          collections: { orderBy: { date_created: 'desc' } },
          domains: true,
        },
      },
    },
  },
} satisfies Prisma.SubmissionVersionSelect;
import type { SubmissionVersionDTO } from '@curvenote/common';
import type { Context } from '../../context.server.js';
import { error401, error404, scopes } from '@curvenote/scms-core';
import { userHasScope } from '../../scopes.helpers.server.js';
import type { ModifiedSiteWorkDTO } from '../sites/submissions/published/get.server.js';
import { formatSiteWorkDTO } from '../sites/submissions/published/get.server.js';
import { SiteContext } from '../../context.site.server.js';
import { formatSubmissionKindSummaryDTO } from '../sites/kinds/get.server.js';
import { formatCollectionSummaryDTO } from '../sites/get.server.js';

export async function dbGetSubmissionVersion(id: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findUnique({
    where: { id },
    select: submissionVersionForPreviewSelect,
  });
}

type PreviewDBO = Prisma.SubmissionVersionGetPayload<{
  select: typeof submissionVersionForPreviewSelect;
}>;

export type ModifiedSubmissionVersionDTO = Omit<SubmissionVersionDTO, 'site_work'> & {
  site_work: ModifiedSiteWorkDTO;
};

function formatPreviewDTO(ctx: Context, dbo: PreviewDBO): ModifiedSubmissionVersionDTO {
  return {
    id: dbo.id,
    date_created: dbo.date_created,
    status: dbo.status,
    submission_id: dbo.submission.id,
    site_name: dbo.submission.site.name,
    site_work: formatSiteWorkDTO(new SiteContext(ctx, dbo.submission.site), dbo),
    submitted_by: {
      id: dbo.submitted_by.id,
      name: dbo.submitted_by.display_name ?? '',
    },
    kind: formatSubmissionKindSummaryDTO(dbo.submission.kind),
    collection: formatCollectionSummaryDTO(dbo.submission.collection),
    links: {
      self: ctx.asApiUrl(`/submissions/versions/${dbo.id}`),
      site: ctx.asApiUrl(`/sites/${dbo.submission.site.name}`),
      submission: ctx.asApiUrl(
        `/sites/${dbo.submission.site.name}/submissions/${dbo.submission.id}`,
      ),
      work: ctx.asApiUrl(`/works/${dbo.work_version.work_id}`),
    },
  };
}

/**
 * This handler is not scoped to a site, so submissions are always assumed private
 * and signed
 *
 * @param ctx
 * @param submissionVersionId
 * @returns
 */
export default async function (
  ctx: Context,
  submissionVersionId: string,
): Promise<Omit<SubmissionVersionDTO, 'site_work'> & { site_work: ModifiedSiteWorkDTO }> {
  if (!ctx.authorized.preview && !ctx.user) throw error401(); // TODO user scopes for this site, admin permissions etc...
  const dbo = await dbGetSubmissionVersion(submissionVersionId);
  if (!dbo) throw error404();

  const previewSignatureHasCorrectScopeId =
    ctx.claims.preview?.scope === 'submission' && ctx.claims.preview.scopeId === dbo.submission.id;

  if (
    !previewSignatureHasCorrectScopeId &&
    ctx.user &&
    !userHasScope(ctx.user, scopes.site.submissions.read, dbo.submission.site.name)
  )
    throw error401('bad submission scope');

  return formatPreviewDTO(ctx, dbo);
}
