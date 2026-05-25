import type { SiteContext } from '@curvenote/scms-server';
import {
  activitySubmissionVersionRefSelect,
  activityWorkVersionRefSelect,
  getPrismaClient,
  siteWorkWorkVersionWithWorkSelect,
} from '@curvenote/scms-server';
import { JobStatus, type Prisma } from '@curvenote/scms-db';
import { KnownJobTypes } from '@curvenote/scms-core';
import type {
  MagicLinkWithAccessCount,
  SiteAppData,
  SiteWithAppData,
  SubmissionDetailSlugRow,
} from './types.js';

const submissionDetailVersionSelect = {
  id: true,
  status: true,
  date_created: true,
  date_published: true,
  job_id: true,
  transition: true,
  submitted_by: { select: { id: true, display_name: true } },
  work_version: { select: siteWorkWorkVersionWithWorkSelect },
} satisfies Prisma.SubmissionVersionSelect;

export type SubmissionDetailRow = {
  id: string;
  date_created: string;
  date_published: string | null;
  submitted_by: { id: string; display_name: string | null };
  kind: { id: string; name: string; content: Prisma.JsonValue };
  collection: {
    id: string;
    name: string;
    content: Prisma.JsonValue;
    workflow: string;
  };
  work: { doi: string | null; key: string | null } | null;
  slugs: { slug: string; primary: boolean }[];
  versions: {
    id: string;
    status: string;
    date_created: string;
    date_published: string | null;
    job_id: string | null;
    transition: Prisma.JsonValue;
    submitted_by: { id: string; display_name: string | null };
    work_version: {
      id: string;
      work_id: string;
      cdn: string | null;
      cdn_key: string | null;
      title: string;
      description: string | null;
      authors: string[];
      doi: string | null;
      work: { id: string; doi: string | null; key: string | null } | null;
    };
  }[];
  activity: {
    id: string;
    date_created: string;
    activity_type: string;
    status: string | null;
    date_published: string | null;
    activity_by: { id: string; display_name: string | null };
    kind: { name: string } | null;
    submission_version: { id: string; date_created: string } | null;
    work_version: { id: string; date_created: string } | null;
  }[];
};

export type SubmissionEditorCollectionRow = {
  id: string;
  name: string;
  content: Prisma.JsonValue;
  kindsInCollection: {
    kind: {
      id: string;
      name: string;
      content: Prisma.JsonValue;
      default: boolean;
    };
  }[];
};

export async function dbLoadSubmissionDetail(
  ctx: SiteContext,
  submissionId: string,
): Promise<{
  submission: SubmissionDetailRow;
  collections: SubmissionEditorCollectionRow[];
} | null> {
  const prisma = await getPrismaClient();
  const [submission, collections] = await Promise.all([
    prisma.submission.findFirst({
      where: { id: submissionId, site_id: ctx.site.id },
      select: {
        id: true,
        date_created: true,
        date_published: true,
        submitted_by: { select: { id: true, display_name: true } },
        kind: { select: { id: true, name: true, content: true } },
        collection: {
          select: { id: true, name: true, content: true, workflow: true },
        },
        work: { select: { doi: true, key: true } },
        slugs: { select: { slug: true, primary: true } },
        versions: {
          select: submissionDetailVersionSelect,
          orderBy: { date_created: 'desc' },
        },
        activity: {
          select: {
            id: true,
            date_created: true,
            activity_type: true,
            status: true,
            date_published: true,
            activity_by: { select: { id: true, display_name: true } },
            kind: { select: { name: true } },
            submission_version: { select: activitySubmissionVersionRefSelect },
            work_version: { select: activityWorkVersionRefSelect },
          },
          orderBy: { date_created: 'desc' },
        },
      },
    }),
    prisma.collection.findMany({
      where: { site_id: ctx.site.id },
      select: {
        id: true,
        name: true,
        content: true,
        kindsInCollection: {
          select: {
            kind: { select: { id: true, name: true, content: true, default: true } },
          },
        },
      },
      orderBy: { date_created: 'desc' },
    }),
  ]);

  if (!submission) {
    return null;
  }

  return { submission, collections };
}

export async function dbListSubmissionSlugRows(
  submissionId: string,
): Promise<SubmissionDetailSlugRow[]> {
  const prisma = await getPrismaClient();
  return prisma.slug.findMany({
    where: { submission_id: submissionId },
    select: {
      id: true,
      slug: true,
      primary: true,
      date_created: true,
      date_modified: true,
    },
    orderBy: [{ date_created: 'desc' }],
  });
}

export async function dbGetSiteAppData(siteName: string): Promise<SiteWithAppData | null> {
  const prisma = await getPrismaClient();
  const site = await prisma.site.findUnique({
    where: { name: siteName },
    select: {
      id: true,
      name: true,
      title: true,
      description: true,
      private: true,
      restricted: true,
      data: true,
    },
  });

  if (!site) {
    return null;
  }

  return {
    ...site,
    data: (site.data as SiteAppData) ?? null,
  };
}

/**
 * True when a running publish/unpublish job targets one of the submission's versions.
 */
export async function dbShouldPollSubmissionVersions(
  siteId: string,
  submissionVersionIds: string[],
  jobTypes: string[] = [KnownJobTypes.PUBLISH, KnownJobTypes.UNPUBLISH],
  statuses: JobStatus[] = [JobStatus.RUNNING],
): Promise<boolean> {
  if (submissionVersionIds.length === 0) {
    return false;
  }

  const prisma = await getPrismaClient();
  const jobs = await prisma.job.findMany({
    where: {
      job_type: { in: jobTypes },
      status: { in: statuses },
      payload: { path: ['site_id'], equals: siteId },
    },
    select: { payload: true },
  });

  const versionIdSet = new Set(submissionVersionIds);
  return jobs.some((job) => {
    const payload = job.payload as { submission_version_id?: string };
    return payload.submission_version_id != null && versionIdSet.has(payload.submission_version_id);
  });
}

export async function dbListMagicLinksForSubmission(
  submissionId: string,
): Promise<MagicLinkWithAccessCount[]> {
  const prisma = await getPrismaClient();
  const links = await prisma.magicLink.findMany({
    where: {
      data: { path: ['submissionId'], equals: submissionId },
    },
    orderBy: { date_created: 'desc' },
    select: {
      id: true,
      date_created: true,
      date_modified: true,
      created_by_id: true,
      type: true,
      data: true,
      expiry: true,
      revoked: true,
      access_limit: true,
    },
  });

  if (links.length === 0) {
    return [];
  }

  const accessCounts = await prisma.magicLinkAccess.groupBy({
    by: ['magic_link_id'],
    where: {
      magic_link_id: { in: links.map((l) => l.id) },
      success: true,
    },
    _count: { _all: true },
  });
  const countByLinkId = new Map(accessCounts.map((row) => [row.magic_link_id, row._count._all]));

  return links.map((link) => ({
    ...link,
    access_count: countByLinkId.get(link.id) ?? 0,
  }));
}
