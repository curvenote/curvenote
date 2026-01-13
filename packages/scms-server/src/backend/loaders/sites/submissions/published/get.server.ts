import type { SiteContext } from '../../../../context.site.server.js';
import type { HostSpec, SiteWorkDTO } from '@curvenote/common';
import type { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../../prisma.server.js';
import { error404 } from '@curvenote/scms-core';
import { formatDate } from '@curvenote/common';
import { signPrivateUrls } from '../../../../sign.private.server.js';
import { formatCollectionSummaryDTO } from '../../get.server.js';
import { formatSubmissionKindSummaryDTO } from '../../kinds/get.server.js';
import { createArticleUrl } from '../../../../domains.server.js';

export async function dbGetLatestPublishedSubmissionVersion(
  siteName: string,
  workIdOrSlug: string,
) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findFirst({
    where: {
      status: 'PUBLISHED',
      submission: {
        site: {
          name: siteName,
        },
      },
      OR: [
        {
          work_version: {
            work_id: workIdOrSlug,
          },
        },
        {
          submission: {
            slugs: {
              some: {
                slug: workIdOrSlug,
              },
            },
          },
        },
      ],
    },
    orderBy: {
      date_created: 'desc',
    },
    include: {
      submitted_by: true,
      submission: {
        include: {
          kind: true,
          collection: true,
          slugs: true,
          work: true,
        },
      },
      work_version: true,
    },
  });
}

export type DBO = Exclude<
  Prisma.PromiseReturnType<typeof dbGetLatestPublishedSubmissionVersion>,
  null
>;

type ModifiedSiteWorkLinksDTO = Omit<SiteWorkDTO['links'], 'thumbnail' | 'social' | 'config'> & {
  thumbnail?: string;
  social?: string;
  config?: string;
  html?: string;
};

export type ModifiedSiteWorkDTO = Omit<SiteWorkDTO, 'links' | 'cdn' | 'cdn_key'> & {
  links: ModifiedSiteWorkLinksDTO;
  cdn?: string;
  cdn_key?: string;
};
export function formatSiteWorkDTO(ctx: SiteContext, dbo: DBO): ModifiedSiteWorkDTO {
  const { cdn_key, cdn, title, description, canonical, authors, date_created } = dbo.work_version;
  const submission_version_id = dbo.id;
  const version_id = dbo.work_version.id;
  const work_id = dbo.work_version.work_id;
  const doi = dbo.work_version.doi ?? dbo.submission.work?.doi;
  const slug = dbo.submission.slugs.reduce(
    (primarySlug, next) => (primarySlug ? primarySlug : next.primary ? next.slug : undefined),
    undefined as string | undefined,
  );

  let thumbnail: string | undefined;
  let social: string | undefined;
  let config: string | undefined;
  let host: HostSpec | undefined;
  if (cdn_key && cdn) {
    const {
      host: hostSpec,
      thumbnail: thumbnailUrl,
      social: socialUrl,
      config: configUrl,
    } = signPrivateUrls(
      ctx,
      { cdn, key: cdn_key },
      ctx.asApiUrl(`/sites/${ctx.site.name}/works/${work_id}/versions/${version_id}/thumbnail`),
      ctx.asApiUrl(`/sites/${ctx.site.name}/works/${work_id}/versions/${version_id}/social`),
    );
    host = hostSpec;
    thumbnail = thumbnailUrl;
    social = socialUrl;
    config = configUrl;
  }

  // Get primary domain for HTML link
  const htmlUrl = createArticleUrl(ctx.site, work_id);

  return {
    id: work_id,
    version_id,
    submission_version_id,
    cdn: cdn ?? undefined,
    cdn_key: cdn_key ?? undefined,
    slug,
    doi: doi ?? undefined,
    key: dbo.submission.work?.key ?? undefined,
    cdn_query: host?.query,
    title: title ?? '',
    description: description || undefined,
    authors: authors.map((a) => ({ name: a })),
    canonical: canonical ? true : false,
    date_created: formatDate(date_created),
    date: dbo.submission.date_published ?? undefined,
    date_published: dbo.submission.date_published ?? undefined,
    kind: formatSubmissionKindSummaryDTO(dbo.submission.kind),
    collection:
      dbo.submission.collection != null
        ? formatCollectionSummaryDTO(dbo.submission.collection)
        : undefined,
    links: {
      // TODO canonical access should work if PUBLISHED - this endpoint simply doesn't exist yet
      self: ctx.asApiUrl(`/sites/${ctx.site.name}/works/${work_id}/versions/${version_id}`),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
      work: ctx.asApiUrl(`/works/${work_id}`),
      html: htmlUrl,
      thumbnail,
      social,
      config,
      doi: doi ? `https://doi.org/${doi}` : undefined,
    },
  };
}

export default async function (ctx: SiteContext, workIdOrSlug: string) {
  const dbo = await dbGetLatestPublishedSubmissionVersion(ctx.site.name, workIdOrSlug);
  if (!dbo) throw error404();
  return formatSiteWorkDTO(ctx, dbo);
}
