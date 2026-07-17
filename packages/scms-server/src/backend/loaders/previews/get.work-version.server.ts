import {
  formatDate,
  type SubmissionKindSummaryDTO,
  type SubmissionVersionDTO,
} from '@curvenote/common';
import type { Prisma } from '@curvenote/scms-db';
import { error401, error404 } from '@curvenote/scms-core';
import type { Context } from '../../context.server.js';
import { formatAuthorDTO } from '../../format.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { siteWorkWorkVersionWithWorkSelect } from '../../prisma.selects.server.js';
import {
  WORK_VERSION_PREVIEW_AUDIENCE,
  WORK_VERSION_PREVIEW_SCOPE,
} from '../../sign.previews.server.js';
import { signPrivateUrls } from '../../sign.private.server.js';
import { fetchWorkVersionSubjects } from '../../work-version-subject.server.js';
import type { ModifiedSiteWorkDTO } from '../sites/submissions/published/get.server.js';

const WORK_VERSION_PREVIEW_KIND: SubmissionKindSummaryDTO = {
  id: WORK_VERSION_PREVIEW_AUDIENCE,
  name: 'Article',
  content: {},
  default: true,
};

const WORK_VERSION_PREVIEW_COLLECTION = {
  id: WORK_VERSION_PREVIEW_AUDIENCE,
  name: 'preview',
  slug: 'preview',
  content: {},
  open: false,
  workflow: '',
};

type WorkVersionPreviewDBO = Prisma.WorkVersionGetPayload<{
  select: typeof siteWorkWorkVersionWithWorkSelect;
}>;

/**
 * Load a work version for token-gated MyST web preview (no submission required).
 * Auth is preview-token only: aud `scms-work-preview`, scope `work_version`,
 * scopeId === workVersionId.
 */
export default async function getWorkVersionPreview(
  ctx: Context,
  workVersionId: string,
): Promise<Omit<SubmissionVersionDTO, 'site_work'> & { site_work: ModifiedSiteWorkDTO }> {
  if (!ctx.authorized.preview) throw error401('preview token required');

  const claims = ctx.claims.preview;
  if (
    claims?.aud !== WORK_VERSION_PREVIEW_AUDIENCE ||
    claims.scope !== WORK_VERSION_PREVIEW_SCOPE ||
    claims.scopeId !== workVersionId
  ) {
    throw error401('bad work version preview scope');
  }

  const prisma = await getPrismaClient();
  const dbo = await prisma.workVersion.findUnique({
    where: { id: workVersionId },
    select: siteWorkWorkVersionWithWorkSelect,
  });
  if (!dbo) throw error404();
  if (!dbo.cdn?.trim() || !dbo.cdn_key?.trim()) throw error404('work version has no CDN site');

  const subjects = await fetchWorkVersionSubjects([dbo.id]);
  const siteWork = formatWorkVersionAsSiteWorkDTO(ctx, dbo, {
    subject: subjects.get(dbo.id),
  });

  return {
    id: dbo.id,
    date_created: formatDate(dbo.date_created),
    status: 'PREVIEW',
    submission_id: dbo.id,
    site_name: 'Preview',
    site_work: siteWork,
    submitted_by: { id: '', name: '' },
    kind: WORK_VERSION_PREVIEW_KIND,
    collection: WORK_VERSION_PREVIEW_COLLECTION,
    links: {
      self: ctx.asApiUrl(`/previews/${dbo.id}`),
      site: ctx.asApiUrl('/'),
      submission: ctx.asApiUrl(`/works/${dbo.work_id}`),
      work: ctx.asApiUrl(`/works/${dbo.work_id}`),
    },
  };
}

function formatWorkVersionAsSiteWorkDTO(
  ctx: Context,
  dbo: WorkVersionPreviewDBO,
  opts?: { subject?: string },
): ModifiedSiteWorkDTO {
  const { cdn_key, cdn, title, description, canonical, authors, date_created } = dbo;
  const version_id = dbo.id;
  const work_id = dbo.work_id;
  const doi = dbo.doi ?? dbo.work.doi ?? undefined;

  let thumbnail: string | undefined;
  let social: string | undefined;
  let config: string | undefined;
  let cdn_query: string | undefined;
  let resolvedCdn = cdn ?? undefined;
  if (cdn_key && cdn) {
    const signed = signPrivateUrls(
      ctx,
      { cdn, key: cdn_key },
      ctx.asApiUrl(`/works/${work_id}/thumbnail`),
      ctx.asApiUrl(`/works/${work_id}/social`),
    );
    thumbnail = signed.thumbnail;
    social = signed.social;
    config = signed.config;
    cdn_query = signed.host.query;
    resolvedCdn = signed.host.cdn;
  }

  return {
    id: work_id,
    version_id,
    submission_version_id: version_id,
    cdn: resolvedCdn,
    cdn_key: cdn_key ?? undefined,
    doi: doi ?? undefined,
    key: dbo.work.key ?? undefined,
    cdn_query,
    title: title ?? '',
    description: description || undefined,
    subject: opts?.subject,
    authors: authors.map((a) => formatAuthorDTO(a)),
    canonical: canonical ? true : false,
    tags: [...dbo.tags],
    date_created: formatDate(date_created),
    date: dbo.date ? formatDate(dbo.date) : undefined,
    kind: WORK_VERSION_PREVIEW_KIND,
    submission_id: version_id,
    links: {
      self: ctx.asApiUrl(`/works/${work_id}/versions/${version_id}`),
      site: ctx.asApiUrl('/'),
      work: ctx.asApiUrl(`/works/${work_id}`),
      submission: ctx.asApiUrl(`/works/${work_id}`),
      versions: ctx.asApiUrl(`/works/${work_id}/versions`),
      thumbnail,
      social,
      config,
      doi: doi ? `https://doi.org/${doi}` : undefined,
    },
  };
}
