import { formatDate } from '@curvenote/common';
import type { SubmissionActivityDTO, SubmissionDTO, SubmissionLinksDTO } from '@curvenote/common';
import type { Prisma } from '@curvenote/scms-db';
import type { SiteContext } from '../../../context.site.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import { signPrivateUrls } from '../../../sign.private.server.js';
import type { ClientExtension } from '@curvenote/scms-core';
import {
  coerceToObject,
  error404,
  getAllTargetStates,
  getWorkflow,
  registerExtensionWorkflows,
} from '@curvenote/scms-core';
import { findImportantVersions } from './utils.server.js';
import { formatSubmissionKindSummaryDTO } from '../kinds/get.server.js';

export async function dbGetSubmission(where: Prisma.SubmissionFindUniqueArgs['where']) {
  const prisma = await getPrismaClient();
  return prisma.submission.findUnique({
    where,
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
      },
    },
  });
}

type DBO = Exclude<Awaited<ReturnType<typeof dbGetSubmission>>, null>;

export function formatSubmissionActivityDTO(
  ctx: SiteContext,
  activity: DBO['activity'][0],
  submission: DBO,
): SubmissionActivityDTO {
  return {
    id: activity.id,
    date_created: formatDate(activity.date_created),
    activity_by: {
      id: activity.activity_by.id,
      name: activity.activity_by.display_name ?? '',
    },
    submission_id: submission.id,
    activity_type: activity.activity_type,
    status: activity.status ?? undefined,
    submission_version: {
      id: activity.submission_version?.id ?? '',
      date_created: formatDate(activity.submission_version?.date_created) ?? '',
    },
    work_version: activity.work_version
      ? {
          id: activity.work_version.id,
          date_created: formatDate(activity.work_version.date_created),
        }
      : undefined,
    kind: activity.kind ? activity.kind.name : undefined,
    date_published: activity.date_published ?? undefined,
    links: {
      self: ctx.asApiUrl(
        `/sites/${ctx.site.name}/submissions/${submission.id}/activity/${activity.id}`,
      ),
      submission: ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${submission.id}`),
    },
  };
}

/**
 * Determine allowed API actions based on collection workflow and submission version statuses
 */
async function getAllowedSubmissionActionTypes(
  ctx: SiteContext,
  collection: { workflow: string },
  versions: { status: string }[],
  extensions: ClientExtension[],
): Promise<string[]> {
  const workflow = await getWorkflow(
    ctx.$config,
    registerExtensionWorkflows(extensions),
    collection.workflow as string,
  );
  if (!workflow) throw new Error(`Workflow ${collection.workflow} not found`);
  if (versions.length === 0) return [];

  const actions: string[] = [];
  versions.forEach((version) => {
    const isCurrentStatePublished = workflow.states[version.status].published;
    const targets = getAllTargetStates(workflow, version.status);
    const hasPublishedTarget = targets.some((target) => target.published);
    const hasUnpublishedTarget = targets.some((target) => !target.published);

    if (!actions.includes('unpublish') && isCurrentStatePublished && hasUnpublishedTarget) {
      actions.push('unpublish');
    }

    if (!actions.includes('publish') && !isCurrentStatePublished && hasPublishedTarget) {
      actions.push('publish');
    }
  });

  return actions;
}

export type ModifiedSubmissionLinksDTO = Omit<SubmissionLinksDTO, 'thumbnail'> & {
  thumbnail?: string;
};

export async function formatSubmissionLinksDTO(
  ctx: SiteContext,
  dbo: DBO,
  dboActive: DBO['versions'][0],
  extensions: ClientExtension[],
): Promise<ModifiedSubmissionLinksDTO> {
  let thumbnail: string | undefined;
  if (dboActive.work_version.cdn && dboActive.work_version.cdn_key) {
    const { thumbnail: thumbnailUrl } = signPrivateUrls(
      ctx,
      { cdn: dboActive.work_version.cdn, key: dboActive.work_version.cdn_key },
      ctx.asApiUrl(
        `/sites/${ctx.site.name}/works/${dboActive.work_version.work_id}/versions/${dboActive.work_version_id}/thumbnail`,
      ),
      'no-social',
    );
    thumbnail = thumbnailUrl;
  }

  const links: ModifiedSubmissionLinksDTO = {
    self: ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${dbo.id}`),
    site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
    versions: ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${dbo.id}/versions`),
    work: ctx.asApiUrl(`/works/${dboActive.work_version.work_id}`),
    thumbnail,
  };
  if (dboActive) {
    links.build = dboActive.job_id ? ctx.asBaseUrl(`/build/${dboActive.job_id}`) : undefined;
    links.work = ctx.asApiUrl(`/works/${dboActive.work_version.work_id}`);
  }

  const actions = await getAllowedSubmissionActionTypes(
    ctx,
    dbo.collection,
    dbo.versions,
    extensions,
  );
  if (actions.includes('publish')) {
    links.publish = ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${dbo.id}/publish`);
  }
  if (actions.includes('unpublish')) {
    links.unpublish = ctx.asApiUrl(`/sites/${ctx.site.name}/submissions/${dbo.id}/unpublish`);
  }

  return links;
}

export async function formatSubmissionDTO(
  ctx: SiteContext,
  dbo: DBO,
  extensions: ClientExtension[],
): Promise<Omit<SubmissionDTO, 'links' | 'work_version'> & { links: ModifiedSubmissionLinksDTO }> {
  const idx = findImportantVersions(dbo.versions);
  const dboPublished = idx.published !== undefined ? dbo.versions[idx.published] : undefined;
  const dboRetracted = idx.retracted !== undefined ? dbo.versions[idx.retracted] : undefined;
  const dboActive = dbo.versions[idx.active ?? idx.published ?? 0];
  const slug = dbo.slugs.reduce(
    (primarySlug, next) => (primarySlug ? primarySlug : next.primary ? next.slug : undefined),
    undefined as string | undefined,
  );

  const links = await formatSubmissionLinksDTO(ctx, dbo, dboActive, extensions);

  return {
    id: dbo.id,
    date_created: formatDate(dbo.date_created),
    date_published: dbo.date_published ?? undefined,
    kind: formatSubmissionKindSummaryDTO(dbo.kind),
    collection: { ...dbo.collection, content: coerceToObject(dbo.collection.content) },
    submitted_by: {
      id: dbo.submitted_by.id,
      name: dbo.submitted_by.display_name ?? '',
    },
    site_name: ctx.site.name,
    slug,
    active_version_id: dboActive?.id,
    published_version_id: dboPublished?.id ?? undefined,
    retracted_version_id: dboRetracted?.id ?? undefined,
    activity: dbo.activity.map((activity) => formatSubmissionActivityDTO(ctx, activity, dbo)),
    links,
  };
}

export default async function (
  ctx: SiteContext,
  submissionId: string,
  extensions: ClientExtension[],
) {
  const dbo = await dbGetSubmission({ id: submissionId });
  if (!dbo) throw error404();
  return formatSubmissionDTO(ctx, dbo, extensions);
}
