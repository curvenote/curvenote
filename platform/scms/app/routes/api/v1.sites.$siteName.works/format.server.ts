import type {
  CollectionSummaryDTO,
  HostSpec,
  SiteWorkDTO,
  SiteWorkListingDTO,
  SubmissionKindSummaryDTO,
} from '@curvenote/common';
import { concatSiteWorkTags, formatDate } from '@curvenote/common';
import { coerceToObject, makePaginationLinks } from '@curvenote/scms-core';
import type {
  submissionVersionForSiteWorkSelect,
  createArticleUrl,
  signPrivateUrls,
  type SiteContext,
} from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';

/**
 * A single submission-version row, as selected by the listing query.
 * Co-located here (rather than imported from scms-server) so the select
 * shape and its formatting can be optimized together in this folder.
 */
export type RowDBO = Prisma.SubmissionVersionGetPayload<{
  select: typeof submissionVersionForSiteWorkSelect;
}>;

/** The shape returned by the listing DB layer in `db.server.ts`. */
export type ListDBO = { items: RowDBO[]; total: number };

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

function formatSubmissionKindSummaryDTO(
  dbo: RowDBO['submission']['kind'],
): SubmissionKindSummaryDTO {
  return {
    id: dbo.id,
    name: dbo.name,
    content: coerceToObject(dbo.content),
    default: dbo.default ?? false,
  };
}

function formatCollectionSummaryDTO(
  dbo: NonNullable<RowDBO['submission']['collection']>,
): CollectionSummaryDTO {
  return {
    id: dbo.id,
    name: dbo.name,
    slug: dbo.slug,
    workflow: dbo.workflow,
    content: coerceToObject(dbo.content),
    open: dbo.open,
  };
}

export function formatSiteWorkDTO(ctx: SiteContext, dbo: RowDBO): ModifiedSiteWorkDTO {
  const { cdn_key, cdn, title, description, canonical, authors, date_created } = dbo.work_version;
  const tags = concatSiteWorkTags(dbo.tags ?? [], dbo.work_version.tags ?? []);
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
    tags,
    date_created: formatDate(date_created),
    date: dbo.submission.date_published ?? undefined,
    date_published: dbo.submission.date_published ?? undefined,
    kind: formatSubmissionKindSummaryDTO(dbo.submission.kind),
    collection:
      dbo.submission.collection != null
        ? formatCollectionSummaryDTO(dbo.submission.collection)
        : undefined,
    submission_id: dbo.submission.id,
    links: {
      // TODO canonical access should work if PUBLISHED - this endpoint simply doesn't exist yet
      self: ctx.asApiUrl(`/sites/${ctx.site.name}/works/${work_id}/versions/${version_id}`),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
      work: ctx.asApiUrl(`/works/${work_id}`),
      submission: ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${dbo.submission.id}`),
      versions: ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${dbo.submission.id}/versions`),
      html: htmlUrl,
      thumbnail,
      social,
      config,
      doi: doi ? `https://doi.org/${doi}` : undefined,
    },
  };
}

export function formatSiteWorkDTOFromSubmissions(
  ctx: SiteContext,
  dbo: ListDBO,
  where?: { collection?: string; kind?: string; status?: string },
  opts?: { page?: number; limit?: number },
): Omit<SiteWorkListingDTO, 'items'> & { items: ModifiedSiteWorkDTO[] } {
  const selfUrl = new URL(ctx.asApiUrl(`/sites/${ctx.site.name}/works`));
  if (where?.collection) selfUrl.searchParams.set('collection', where?.collection ?? '');
  if (where?.kind) selfUrl.searchParams.set('kind', where?.kind ?? '');
  if (where?.status) selfUrl.searchParams.set('status', where?.status ?? '');

  const links = makePaginationLinks(
    {
      self: selfUrl.toString(),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
    },
    dbo.total,
    opts ?? {},
  );

  return {
    items: dbo.items.map((v) => formatSiteWorkDTO(ctx, v)),
    total: dbo.total,
    links,
  };
}
