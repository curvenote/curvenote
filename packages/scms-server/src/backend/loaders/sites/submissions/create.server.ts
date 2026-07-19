import type { ClientExtension } from '@curvenote/scms-core';
import { error401, TrackEvent, asSiteSubmissionUrl } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';
import {
  activitySubmissionVersionRefSelect,
  activityWorkVersionRefSelect,
  siteWorkWorkVersionWithWorkSelect,
} from '../../../prisma.selects.server.js';
import { formatSubmissionDTO } from './get.server.js';
import getSubmissionVersion from './versions/get.server.js';
import { formatDate, normalizeExplicitTags } from '@curvenote/common';
import type { UserDBO } from '../../../db.types.js';
import { ActivityType, type Prisma } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';
import type { SiteContext } from '../../../context.site.server.js';
import { SlackEventType } from '../../../services/slack.server.js';

/**
 * Adds a new submission to the database, also making the same entry in the submission history.
 *
 * @param submittedBy
 * @param siteName
 * @param workVersionId
 * @param kind
 * @returns
 */
export async function dbCreateNewSubmission(
  submittedBy: UserDBO,
  siteName: string,
  workVersionId: string,
  kindId: string,
  draft: boolean,
  jobId?: string,
  collectionId?: string,
  metadata?: Record<string, any>,
  tags?: string[],
  txIn?: Prisma.TransactionClient,
) {
  // creating a new submission entry as a nested query in a submissionHistory
  // means it will be created in the same transaction
  const date_created = formatDate();
  const prisma = await getPrismaClient();
  const workVersion = await prisma.workVersion.findUnique({
    where: {
      id: workVersionId,
    },
    select: { work_id: true },
  });
  const submissionTags = normalizeExplicitTags(tags);
  const run = async (tx: Prisma.TransactionClient) => {
    const sv = await tx.submissionVersion.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        submitted_by: {
          connect: {
            id: submittedBy.id,
          },
        },
        status: draft ? 'DRAFT' : 'PENDING',
        tags: submissionTags,
        metadata: metadata ?? undefined,
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
        job: jobId
          ? {
              connect: {
                id: jobId,
              },
            }
          : undefined,
        submission: {
          create: {
            id: uuid(),
            date_created,
            date_modified: date_created,
            submitted_by: {
              connect: {
                id: submittedBy.id,
              },
            },
            kind: {
              connect: {
                id: kindId,
              },
            },
            collection: {
              connect: {
                id: collectionId,
              },
            },
            site: {
              connect: {
                name: siteName,
              },
            },
            work: {
              connect: {
                id: workVersion?.work_id,
              },
            },
          },
        },
      },
      include: {
        submission: {
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
                  select: siteWorkWorkVersionWithWorkSelect,
                },
              },
              orderBy: {
                date_created: 'desc',
              },
            },
          },
        },
      },
    });

    const activity = await tx.activity.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        activity_by: {
          connect: {
            id: submittedBy.id,
          },
        },
        submission: {
          connect: {
            id: sv.submission.id,
          },
        },
        submission_version: {
          connect: {
            id: sv.id,
          },
        },
        activity_type: ActivityType.NEW_SUBMISSION,
        status: sv.status,
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
        kind: {
          connect: {
            id: kindId,
          },
        },
      },
      include: {
        kind: true,
        activity_by: true,
        submission_version: { select: activitySubmissionVersionRefSelect },
        work_version: { select: activityWorkVersionRefSelect },
      },
    });

    return { ...sv.submission, activity: [activity] };
  };
  if (txIn) return run(txIn);
  return prisma.$transaction(run);
}

type CreateSubmissionArgs = {
  ctx: SiteContext;
  workVersionId: string;
  kindId: string;
  draft: boolean;
  jobId?: string;
  collectionId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  tx?: Prisma.TransactionClient;
};

async function createSubmissionRecord({
  ctx,
  workVersionId,
  kindId,
  draft,
  jobId,
  collectionId,
  metadata,
  tags,
  tx,
}: CreateSubmissionArgs) {
  if (!ctx.user) throw error401();
  return dbCreateNewSubmission(
    ctx.user,
    ctx.site.name,
    workVersionId,
    kindId,
    draft,
    jobId,
    collectionId,
    metadata,
    tags,
    tx,
  );
}

export async function notifyNewSubmissionCreated(
  ctx: SiteContext,
  submission: Awaited<ReturnType<typeof dbCreateNewSubmission>>,
  draft: boolean,
) {
  const createdVersion = submission.versions[0];
  await ctx.trackEvent(TrackEvent.SUBMISSION_CREATED, {
    submissionId: submission.id,
    submissionVersionId: createdVersion.id,
    workId: createdVersion.work_version.work_id,
    workTitle: createdVersion.work_version.title,
    kindId: submission.kind.id,
    kindName: submission.kind.name,
    collectionId: submission.collection.id,
    collectionName: submission.collection.name,
    isDraft: draft,
    status: createdVersion.status,
  });

  const submissionUrl = asSiteSubmissionUrl(ctx.asBaseUrl, ctx.site.name, submission.id);
  await ctx.sendSlackNotification({
    eventType: SlackEventType.SUBMISSION_VERSION_CREATED,
    message: `New submission: ${createdVersion.work_version.title ?? 'Untitled'}`,
    user: ctx.user,
    metadata: {
      title: createdVersion.work_version.title,
      status: createdVersion.status,
      site: ctx.site.name,
      collection: submission.collection.name,
      kind: submission.kind.name,
      submissionId: submission.id,
      submissionVersionId: createdVersion.id,
      submissionUrl,
      workId: createdVersion.work_version.work_id,
    },
  });
}

export default async function create(
  ctx: SiteContext,
  extensions: ClientExtension[],
  workId: string,
  kindId: string,
  draft: boolean,
  jobId?: string,
  collectionId?: string,
  metadata?: Record<string, any>,
  tags?: string[],
) {
  // TODO - check does site allow anonymous submissions?
  // TODO - check does site allow submissions from this user?
  // TODO - rate limit the user?
  const submission = await createSubmissionRecord({
    ctx,
    workVersionId: workId,
    kindId,
    draft,
    jobId,
    collectionId,
    metadata,
    tags,
  });

  await notifyNewSubmissionCreated(ctx, submission, draft);
  return formatSubmissionDTO(ctx, submission, extensions);
}

/** Like `create`, but returns the created submission version DTO (same shape as `versions.create`). */
export async function createReturningVersion(
  ctx: SiteContext,
  extensions: ClientExtension[],
  workVersionId: string,
  kindId: string,
  draft: boolean,
  jobId?: string,
  collectionId?: string,
  metadata?: Record<string, any>,
  tags?: string[],
  tx?: Prisma.TransactionClient,
) {
  const submission = await createSubmissionRecord({
    ctx,
    workVersionId,
    kindId,
    draft,
    jobId,
    collectionId,
    metadata,
    tags,
    tx,
  });

  const submissionVersionId = submission.versions[0].id;
  if (tx) {
    return { id: submissionVersionId, submission };
  }

  await notifyNewSubmissionCreated(ctx, submission, draft);
  return getSubmissionVersion(ctx, submissionVersionId);
}
