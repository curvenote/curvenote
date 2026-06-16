import type {
  CollectionSummaryDTO,
  HostSpec,
  SiteWorkDTO,
  SiteWorkListingDTO,
  SubmissionKindSummaryDTO,
} from '@curvenote/common';
import { concatSiteWorkTags, formatDate } from '@curvenote/common';
import { coerceToObject, makePaginationLinks } from '@curvenote/scms-core';
// Value imports: called at runtime — must NOT be converted to `import type`
// (doing so elides them and yields a `ReferenceError` at call time).
import { createArticleUrl, signPrivateUrls } from '@curvenote/scms-server';
import type { SiteContext } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';

/**
 * The exact set of columns/relations this endpoint's formatter reads — nothing
 * more. Narrower than the shared `submissionVersionForSiteWorkSelect`: it drops
 * `submitted_by` (unused → removes a whole query), version bookkeeping columns
 * (`status`, `transition`, `job_id`, `date_*`), `kind.checks`, `work.contains`,
 * and `work_version.{draft,occ,date}`, and fetches only the primary slug. Kept
 * co-located so the select and the formatting that consumes it evolve together.
 */
export const siteWorkListingSelect = {
  id: true,
  tags: true,
  work_version: {
    select: {
      id: true,
      work_id: true,
      cdn: true,
      cdn_key: true,
      title: true,
      description: true,
      authors: true,
      tags: true,
      doi: true,
      canonical: true,
      date_created: true,
    },
  },
  submission: {
    select: {
      id: true,
      date_published: true,
      kind: { select: { id: true, name: true, content: true, default: true } },
      collection: {
        select: { id: true, name: true, slug: true, workflow: true, content: true, open: true },
      },
      slugs: { where: { primary: true }, select: { slug: true, primary: true }, take: 1 },
      work: { select: { doi: true, key: true } },
    },
  },
} satisfies Prisma.SubmissionVersionSelect;

/**
 * A single listing row, as selected by `siteWorkListingSelect` and consumed by
 * the formatter.
 */
export type RowDBO = Prisma.SubmissionVersionGetPayload<{
  select: typeof siteWorkListingSelect;
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

export function formatSiteWorkDTO(
  ctx: SiteContext,
  dbo: RowDBO,
  opts?: { subject?: string },
): ModifiedSiteWorkDTO {
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
    subject: opts?.subject,
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
  where?: {
    collection?: string;
    kind?: string;
    status?: string;
    q?: string;
    subject?: string;
    from?: string;
    to?: string;
  },
  opts?: {
    page?: number;
    limit?: number;
    sort?: 'published_desc' | 'published_asc';
    subjects?: Map<string, string>;
  },
): Omit<SiteWorkListingDTO, 'items'> & { items: ModifiedSiteWorkDTO[] } {
  const selfUrl = new URL(ctx.asApiUrl(`/sites/${ctx.site.name}/works`));
  if (where?.collection) selfUrl.searchParams.set('collection', where?.collection ?? '');
  if (where?.kind) selfUrl.searchParams.set('kind', where?.kind ?? '');
  if (where?.status) selfUrl.searchParams.set('status', where?.status ?? '');
  if (where?.q) selfUrl.searchParams.set('q', where.q);
  if (where?.subject) selfUrl.searchParams.set('subject', where.subject);
  if (where?.from) selfUrl.searchParams.set('from', where.from);
  if (where?.to) selfUrl.searchParams.set('to', where.to);
  // Only emit a non-default sort so default listings keep clean, cache-friendly URLs.
  if (opts?.sort && opts.sort !== 'published_desc') selfUrl.searchParams.set('sort', opts.sort);

  const links = makePaginationLinks(
    {
      self: selfUrl.toString(),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
    },
    dbo.total,
    opts ?? {},
  );

  return {
    items: dbo.items.map((v) =>
      formatSiteWorkDTO(ctx, v, { subject: opts?.subjects?.get(v.work_version.id) }),
    ),
    total: dbo.total,
    links,
  };
}
