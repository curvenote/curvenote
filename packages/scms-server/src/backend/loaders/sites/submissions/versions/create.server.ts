import type { ClientExtension } from '@curvenote/scms-core';
import { error401, TrackEvent } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../../prisma.server.js';
import { formatSubmissionVersionDTO } from './get.server.js';
import { formatDate } from '@curvenote/common';
import { $Enums } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';
import type { SiteContext } from '../../../../context.site.server.js';
import { dbGetWorkflowForSubmission } from '../../../../../workflow/utils.server.js';
import { SlackEventType } from '../../../../services/slack.server.js';

/**
 * Adds a new submission to the database, also making the same entry in the submission history.
 *
 * @param submittedBy
 * @param siteName
 * @param workVersionId
 * @param kind
 * @returns
 */
export async function dbCreateNewSubmissionVersionOnExistingSubmission(
  ctx: SiteContext,
  extensions: ClientExtension[],
  submissionId: string,
  workVersionId: string,
  jobId?: string,
) {
  if (!ctx.user) throw error401();
  const user = ctx.user;

  const date_created = formatDate();
  const prisma = await getPrismaClient();

  // Get the workflow for the submission
  const workflow = await dbGetWorkflowForSubmission(ctx, submissionId, extensions);

  return prisma.$transaction(async (tx) => {
    const sv = await tx.submissionVersion.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        submitted_by: {
          connect: {
            id: user.id,
          },
        },
        status: workflow.initialState,
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
        submission: {
          connect: {
            id: submissionId,
          },
        },
        job: jobId ? { connect: { id: jobId } } : undefined,
      },
      include: {
        submitted_by: true,
        work_version: {
          include: {
            work: true,
          },
        },
        submission: {
          include: {
            kind: true,
            collection: true,
            slugs: true,
            work: true,
          },
        },
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        activity_by: {
          connect: {
            id: user.id,
          },
        },
        submission: {
          connect: {
            id: submissionId,
          },
        },
        submission_version: {
          connect: {
            id: sv.id,
          },
        },
        activity_type: $Enums.ActivityType.SUBMISSION_VERSION_ADDED,
        status: sv.status,
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
      },
      include: {
        activity_by: true,
        kind: true,
        submission_version: true,
        work_version: { include: { work: true } },
      },
    });

    return sv;
  });
}

export default async function (
  ctx: SiteContext,
  extensions: ClientExtension[],
  submissionId: string,
  workVersionId: string,
  jobId?: string,
) {
  if (!ctx.user) throw error401();
  const dbo = await dbCreateNewSubmissionVersionOnExistingSubmission(
    ctx,
    extensions,
    submissionId,
    workVersionId,
    jobId,
  );

  await ctx.trackEvent(TrackEvent.SUBMISSION_VERSION_CREATED, {
    submissionId: dbo.submission_id,
    submissionVersionId: dbo.id,
    workId: dbo.work_version.work_id,
    workTitle: dbo.work_version.title,
    kindId: dbo.submission.kind.id,
    kindName: dbo.submission.kind.name,
    collectionId: dbo.submission.collection.id,
    collectionName: dbo.submission.collection.name,
    status: dbo.status,
  });

  await ctx.sendSlackNotification({
    eventType: SlackEventType.SUBMISSION_VERSION_CREATED,
    message: `New submission version: ${ctx.asBaseUrl(`/app/sites/${ctx.site.name}/submissions/${dbo.submission_id}`)}`,
    user: ctx.user,
    metadata: {
      title: dbo.work_version.title,
      status: dbo.status,
      site: ctx.site.name,
      collection: dbo.submission.collection.name,
      kind: dbo.submission.kind.name,
      submissionId: dbo.submission_id,
      submissionVersionId: dbo.id,
      workId: dbo.work_version.work_id,
    },
  });
  return formatSubmissionVersionDTO(ctx, dbo);
}
