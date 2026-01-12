import type { SiteContext } from '../../../context.site.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import { coerceToObject, error404 } from '@curvenote/scms-core';
import type { Prisma } from '@prisma/client';
import { formatAuthorDTO } from '../../../format.server.js';
import { findImportantVersions } from './utils.server.js';
import { formatSubmissionLinksDTO } from './get.server.js';
import { formatSubmissionKindSummaryDTO } from '../kinds/get.server.js';
import type { ClientExtension, WorkflowTransition } from '@curvenote/scms-core';

export async function dbListSubmissions(
  where: Prisma.SubmissionFindManyArgs['where'],
  skip?: number,
  take?: number,
) {
  const prisma = await getPrismaClient();
  return prisma.submission.findMany({
    where,
    skip,
    take,
    include: {
      kind: true,
      collection: true,
      submitted_by: true,
      slugs: true,
      work: true,
      site: {
        include: {
          submissionKinds: true,
          collections: { orderBy: { date_created: 'desc' } },
          domains: true,
        },
      },
      versions: {
        include: {
          submitted_by: true,
          work_version: {
            include: {
              work: true,
            },
          },
        },
        orderBy: {
          date_created: 'desc',
        },
      },
      activity: {
        include: {
          activity_by: true,
          kind: true,
          submission_version: true,
          work_version: true,
        },
        orderBy: {
          date_created: 'desc',
        },
        take: 1,
      },
    },
    orderBy: [
      {
        date_published: 'desc', // Null values (never published submissions) come first, then are ordered by date_created
      },
      {
        date_created: 'desc',
      },
    ],
  });
}

export async function dbListSiteSubmissions(
  siteName: string,
  where: Prisma.SubmissionWhereInput = {},
  skip?: number,
  take?: number,
) {
  return dbListSubmissions({ site: { is: { name: siteName } }, ...where }, skip, take);
}

type DBO = Exclude<Prisma.PromiseReturnType<typeof dbListSiteSubmissions>, null>;

type SubmissionVersionDBOFragment = {
  id: string;
  date_created: string;
  status: string;
  submitted_by: {
    id: string;
    display_name: string | null;
  };
  work_version: {
    id: string;
    work_id: string;
    metadata: Prisma.JsonValue;
  };
  job_id: string | null;
};

export function formatVersionSummaryDTO(ctx: SiteContext, dbo: SubmissionVersionDBOFragment) {
  return {
    id: dbo.id,
    date_created: dbo.date_created,
    status: dbo.status,
    submitted_by: {
      id: dbo.submitted_by.id,
      name: dbo.submitted_by.display_name ?? '',
    },
    work_id: dbo.work_version.work_id,
    work_version_id: dbo.work_version.id,
    work_version_metadata: dbo.work_version.metadata,
    job_id: dbo.job_id ?? undefined,
  };
}

export async function formatSubmissionItemDTO(
  ctx: SiteContext,
  dbo: DBO[0],
  extensions: ClientExtension[],
) {
  // TODO this should be the best version
  if (dbo.versions.length === 0) return null;

  const idx = findImportantVersions(dbo.versions);
  const dboPublished = idx.published !== undefined ? dbo.versions[idx.published] : undefined;
  const dboRetracted = idx.retracted !== undefined ? dbo.versions[idx.retracted] : undefined;
  const dboActive = dbo.versions[idx.active ?? idx.published ?? 0];

  const wv = dboActive.work_version;

  const slug = dbo.slugs.find((s) => s.primary)?.slug ?? dbo.slugs?.[0]?.slug ?? undefined;
  const links = await formatSubmissionLinksDTO(ctx, dbo, dboActive, extensions);
  return {
    id: dbo.id,
    date_created: dbo.date_created,
    date_published: dbo.date_published ?? undefined,
    kind: formatSubmissionKindSummaryDTO(dbo.kind),
    collection: { ...dbo.collection, content: coerceToObject(dbo.collection.content) },
    submitted_by: {
      id: dbo.submitted_by.id,
      name: dbo.submitted_by.display_name ?? '',
    },
    slug,
    site_name: ctx.site.name,
    title: wv.title,
    authors: wv.authors.map((a) => formatAuthorDTO(a)),
    description: wv.description ?? undefined,
    date: wv.date ?? undefined,
    doi: wv.doi ?? dbo.work?.doi ?? undefined,
    status: dboActive.status,
    transition:
      dboActive.transition == null ? undefined : (dboActive.transition as WorkflowTransition),
    version_id: dboActive.id,
    job_id: dboActive.job_id ?? undefined,
    active_version: formatVersionSummaryDTO(ctx, dboActive),
    published_version: dboPublished ? formatVersionSummaryDTO(ctx, dboPublished) : undefined,
    retracted_version: dboRetracted ? formatVersionSummaryDTO(ctx, dboRetracted) : undefined,
    num_versions: dbo.versions.length,
    last_activity: {
      date: dbo.activity[0]?.date_created,
      by: {
        id: dbo.activity[0]?.activity_by.id,
        name: dbo.activity[0]?.activity_by.display_name ?? '',
      },
    },
    links,
  };
}

async function formatSubmissionListingDTO(
  ctx: SiteContext,
  dbo: DBO,
  extensions: ClientExtension[],
) {
  const items = (
    await Promise.all(
      dbo.map(async (s) => {
        return formatSubmissionItemDTO(ctx, s, extensions);
      }),
    )
  ).filter((s) => s != null);
  const dto = {
    items,
    links: {
      self: ctx.request.url,
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
    },
  };

  return dto;
}

export default async function (
  ctx: SiteContext,
  extensions: ClientExtension[],
  where?: Prisma.SubmissionWhereInput,
  skip?: number,
  take?: number,
) {
  const dbo = await dbListSiteSubmissions(ctx.site.name, where, skip, take);
  if (!dbo) throw error404();
  return formatSubmissionListingDTO(ctx, dbo, extensions);
}
