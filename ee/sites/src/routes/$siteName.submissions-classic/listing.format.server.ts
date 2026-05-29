import type { Prisma } from '@curvenote/scms-db';
import type { SiteContext } from '@curvenote/scms-server';
import { coerceToObject } from '@curvenote/scms-core';
import type { WorkflowTransition } from '@curvenote/scms-core';
import { findImportantVersions, type ListingVersionChip } from './listing.utils.server.js';
import type { SubmissionListingItem } from './types.js';

export type ListingSubmissionRow = {
  id: string;
  date_created: string;
  date_published: string | null;
  submitted_by: { id: string; display_name: string | null };
  kind: { id: string; name: string; content: Prisma.JsonValue };
  collection: {
    id: string;
    name: string;
    slug: string;
    open: boolean;
    content: Prisma.JsonValue;
    workflow: string;
  };
  slugs: { slug: string; primary: boolean }[];
  work: { doi: string | null } | null;
  _count: { versions: number };
  versions: ListingVersionChip[];
  activity: {
    date_created: string;
    activity_by: { id: string; display_name: string | null };
  }[];
};

export type ActiveVersionWork = {
  id: string;
  work_id: string;
  title: string;
  description: string | null;
  authors: string[];
  date: string | null;
  doi: string | null;
  work: { doi: string | null } | null;
};

function formatListingBuildLink(
  ctx: SiteContext,
  jobId: string | null | undefined,
): string | undefined {
  return jobId ? ctx.asBaseUrl(`/build/${jobId}`) : undefined;
}

export function formatSubmissionListingItem(
  ctx: SiteContext,
  row: ListingSubmissionRow,
  activeWork: ActiveVersionWork | undefined,
): SubmissionListingItem | null {
  if (row.versions.length === 0 || !activeWork) {
    return null;
  }

  const idx = findImportantVersions(row.versions);
  const publishedRow = idx.published !== undefined ? row.versions[idx.published] : undefined;
  const retractedRow = idx.retracted !== undefined ? row.versions[idx.retracted] : undefined;
  const activeRow = row.versions[idx.active ?? idx.published ?? 0];

  const kindContent = coerceToObject(row.kind.content);
  const collectionContent = coerceToObject(row.collection.content);
  const slug = row.slugs.find((s) => s.primary)?.slug ?? row.slugs[0]?.slug ?? undefined;
  const lastActivity = row.activity[0];

  return {
    id: row.id,
    date_created: row.date_created,
    date_published: row.date_published ?? undefined,
    title: activeWork.title,
    authors: activeWork.authors.map((name) => ({ name })),
    description: activeWork.description ?? undefined,
    date: activeWork.date ?? undefined,
    doi: activeWork.doi ?? row.work?.doi ?? undefined,
    slug,
    status: activeRow.status,
    transition:
      activeRow.transition == null ? undefined : (activeRow.transition as WorkflowTransition),
    version_id: activeRow.id,
    job_id: activeRow.job_id ?? undefined,
    kind: {
      id: row.kind.id,
      name: row.kind.name,
      content: kindContent,
    },
    collection: {
      id: row.collection.id,
      name: row.collection.name,
      slug: row.collection.slug,
      workflow: row.collection.workflow,
      open: row.collection.open,
      content: collectionContent,
    },
    published_version: publishedRow
      ? {
          date_created: publishedRow.date_created,
          work_id: publishedRow.work_version.work_id,
        }
      : undefined,
    retracted_version: retractedRow ? { date_created: retractedRow.date_created } : undefined,
    last_activity: {
      date: lastActivity?.date_created ?? row.date_created,
      by: {
        id: lastActivity?.activity_by.id ?? row.submitted_by.id,
        name: lastActivity?.activity_by.display_name ?? row.submitted_by.display_name ?? '',
      },
    },
    links: {
      build: formatListingBuildLink(ctx, activeRow.job_id),
    },
    num_versions: row._count.versions,
  };
}
