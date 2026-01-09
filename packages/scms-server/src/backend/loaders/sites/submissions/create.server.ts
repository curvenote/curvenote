import type { ClientExtension } from '@curvenote/scms-core';
import { error401, TrackEvent } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';
import { formatSubmissionDTO } from './get.server.js';
import { formatDate } from '@curvenote/common';
import type { UserDBO } from '../../../db.types.js';
import { ActivityType } from '@prisma/client';
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
) {
  // creating a new submission entry as a nested query in a submissionHistory
  // means it will be created in the same transaction
  const date_created = formatDate();
  const prisma = await getPrismaClient();
  const workVersion = await prisma.workVersion.findUnique({
    where: {
      id: workVersionId,
    },
  });
  return prisma.$transaction(async (tx) => {
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
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
        job: {
          connect: {
            id: jobId,
          },
        },
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
                  include: {
                    work: true,
                  },
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
        submission_version: true,
        work_version: { include: { work: true } },
      },
    });

    return { ...sv.submission, activity: [activity] };
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
) {
  if (!ctx.user) throw error401(); // ctx.secure()
  // TODO - check does site allow anonymous submissions?
  // TODO - check does site allow submissions from this user?
  // TODO - rate limit the user?
  const submission = await dbCreateNewSubmission(
    ctx.user,
    ctx.site.name,
    workId,
    kindId,
    draft,
    jobId,
    collectionId,
  );

  await ctx.trackEvent(TrackEvent.SUBMISSION_CREATED, {
    submissionId: submission.id,
    submissionVersionId: submission.versions[0].id,
    workId: submission.versions[0].work_version.work_id,
    workTitle: submission.versions[0].work_version.title,
    kindId: submission.kind.id,
    kindName: submission.kind.name,
    collectionId: submission.collection.id,
    collectionName: submission.collection.name,
    isDraft: draft,
    status: submission.versions[0].status,
  });

  await ctx.sendSlackNotification({
    eventType: SlackEventType.SUBMISSION_VERSION_CREATED,
    message: `New submission: ${ctx.asBaseUrl(`/app/sites/${ctx.site.name}/submissions/${submission.id}`)}`,
    user: ctx.user,
    metadata: {
      title: submission.versions[0].work_version.title,
      status: submission.versions[0].status,
      site: ctx.site.name,
      collection: submission.collection.name,
      kind: submission.kind.name,
      submissionId: submission.id,
      submissionVersionId: submission.versions[0].id,
      workId: submission.versions[0].work_version.work_id,
    },
  });
  return formatSubmissionDTO(ctx, submission, extensions);
}
