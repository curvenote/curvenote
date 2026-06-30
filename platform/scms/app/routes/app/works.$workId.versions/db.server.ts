import { getPrismaClient } from '@curvenote/scms-server';
import type { WorkVersionTimelineEntry, Workflow } from '@curvenote/scms-core';
import { dbGetCheckServiceRunsByWorkVersionIds } from '../works.$workId/db.server.js';

function siteLogoFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object' || !('logo' in metadata)) {
    return undefined;
  }
  const logo = (metadata as { logo?: unknown }).logo;
  return typeof logo === 'string' ? logo : undefined;
}

function mapSubmissionVersions(
  submissionVersions: Array<{
    id: string;
    status: string;
    tags: string[];
    date_published: string | null;
    submission: {
      id: string;
      site: { name: string; title: string | null; metadata: unknown };
      collection: { workflow: string };
    };
  }>,
  workflows: Record<string, Workflow>,
): WorkVersionTimelineEntry['submissionVersions'] {
  return submissionVersions
    .map((sv) => {
      const workflow = workflows[sv.submission.collection.workflow] ?? workflows.SIMPLE;
      const state = workflow?.states[sv.status];
      const site = sv.submission.site;

      return {
        id: sv.id,
        submissionId: sv.submission.id,
        status: sv.status,
        statusLabel: state?.label ?? sv.status,
        date_published: sv.date_published ?? undefined,
        tag: sv.tags[0],
        statusTags: state?.tags,
        site: {
          name: site.name,
          title: site.title ?? undefined,
          logo: siteLogoFromMetadata(site.metadata),
        },
      };
    })
    .sort((a, b) => a.site.name.localeCompare(b.site.name));
}

function latestCheckRunsByKind(
  runs: Awaited<ReturnType<typeof dbGetCheckServiceRunsByWorkVersionIds>>[string] = [],
): WorkVersionTimelineEntry['checkRuns'] {
  const seenKinds = new Set<string>();
  return runs
    .filter((run) => {
      if (seenKinds.has(run.kind)) return false;
      seenKinds.add(run.kind);
      return true;
    })
    .map((run) => ({
      id: run.id,
      work_version_id: run.work_version_id,
      kind: run.kind,
      date_created: run.date_created,
      date_modified: run.date_modified,
      data: run.data,
    }));
}

/**
 * All work versions for the version-timeline hover card (newest first).
 */
export async function dbLoadWorkVersionsTimeline(
  workId: string,
  workflows: Record<string, Workflow>,
): Promise<WorkVersionTimelineEntry[]> {
  const prisma = await getPrismaClient();

  const rows = await prisma.workVersion.findMany({
    where: { work_id: workId },
    orderBy: { date_created: 'desc' },
    select: {
      id: true,
      date_created: true,
      date_modified: true,
      draft: true,
      submissionVersions: {
        select: {
          id: true,
          status: true,
          tags: true,
          date_published: true,
          submission: {
            select: {
              id: true,
              site: {
                select: {
                  name: true,
                  title: true,
                  metadata: true,
                },
              },
              collection: {
                select: {
                  workflow: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const workVersionIds = rows.map((row) => row.id);
  const runsByVersionId = await dbGetCheckServiceRunsByWorkVersionIds(workVersionIds);

  return rows.map((row) => ({
    id: row.id,
    date_created: row.date_created,
    date_modified: row.date_modified,
    draft: row.draft,
    submissionVersions: mapSubmissionVersions(row.submissionVersions, workflows),
    checkRuns: latestCheckRunsByKind(runsByVersionId[row.id]),
  }));
}
