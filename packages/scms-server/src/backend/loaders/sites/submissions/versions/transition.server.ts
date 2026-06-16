import { ActivityType } from '@curvenote/scms-db';
import {
  error401,
  error403,
  httpError,
  hyphenatedFromDate,
  canTransitionTo,
  getValidTransition,
  getJobType,
  asSiteSubmissionUrl,
} from '@curvenote/scms-core';
import { getPrismaClient } from '../../../../prisma.server.js';
import {
  activitySubmissionVersionRefSelect,
  activityWorkVersionRefSelect,
  submissionVersionForListSelect,
  siteWorkWorkVersionWithWorkSelect,
} from '../../../../prisma.selects.server.js';
import type { Prisma } from '@curvenote/scms-db';

/** Publish/unpublish pre-transition load (excludes submission-version metadata). */
const submissionVersionForTransitionSelect = {
  id: true,
  date_created: true,
  date_published: true,
  status: true,
  transition: true,
  job_id: true,
  work_version_id: true,
  submitted_by: { select: { id: true, display_name: true, email: true } },
  work_version: { select: siteWorkWorkVersionWithWorkSelect },
  submission: {
    select: {
      id: true,
      site_id: true,
      kind: true,
      collection: true,
      work: true,
    },
  },
} satisfies Prisma.SubmissionVersionSelect;

export async function dbGetSubmissionVersionForTransition(
  where: Prisma.SubmissionVersionFindUniqueArgs['where'],
) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findUnique({
    where,
    select: submissionVersionForTransitionSelect,
  });
}

const submissionTransitionReturnSubmissionSelect = {
  id: true,
  date_created: true,
  date_published: true,
  kind: true,
  collection: true,
  submitted_by: true,
  slugs: true,
  work: true,
  versions: {
    select: submissionVersionForListSelect,
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
} satisfies Prisma.SubmissionSelect;

const submissionVersionTransitionUpdateSelect = {
  id: true,
  status: true,
  job_id: true,
  transition: true,
  work_version_id: true,
  submission: { select: submissionTransitionReturnSubmissionSelect },
  work_version: { select: siteWorkWorkVersionWithWorkSelect },
} satisfies Prisma.SubmissionVersionSelect;
import { userHasScopes } from '../../../../scopes.helpers.server.js';
import * as slugs from '../slugs.server.js';
import type { SiteContext } from '../../../../context.site.server.js';
import { enqueueAndDispatchJob } from '../../../../jobs/enqueue/enqueueAndDispatchJob.server.js';
import { uuidv7 } from 'uuidv7';
import type { Workflow, WorkflowTransition } from '@curvenote/scms-core';
import { SlackEventType } from '../../../../services/slack.server.js';

/**
 * Get the latest submission version
 *
 * If status is provided, the latest submission of that status will be retrieved
 */
export async function dbGetLatestSubmissionVersionFromSubmission(
  siteName: string,
  submissionId: string,
  status?: string,
) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findFirst({
    where: {
      submission: {
        site: {
          name: siteName,
        },
        id: submissionId,
      },
      status,
    },
    orderBy: {
      date_created: 'desc',
    },
    select: submissionVersionForTransitionSelect,
  });
}

type LatestSubmissionVersionDBO = Prisma.SubmissionVersionGetPayload<{
  select: typeof submissionVersionForTransitionSelect;
}>;

async function startJobBasedTransition(
  ctx: SiteContext,
  existing: LatestSubmissionVersionDBO,
  transition: WorkflowTransition,
  datePublished: string,
) {
  const jobType = getJobType(transition);
  if (!ctx.user) {
    throw error401(
      jobType
        ? `Unauthorized - cannot start ${jobType} job without user credentials`
        : 'User is not authenticated',
    );
  }

  const prisma = await getPrismaClient();
  const jobId = uuidv7();
  const userId = ctx.user.id;

  const updated = await prisma.$transaction(async (tx) => {
    const statefulTransition = {
      ...transition,
      state: {
        ...transition.state,
        jobId,
      },
    };
    const timestamp = new Date().toISOString();
    const row = await tx.submissionVersion.update({
      where: { id: existing.id },
      data: {
        transition: statefulTransition,
        date_modified: timestamp,
      },
      select: submissionVersionTransitionUpdateSelect,
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by_id: userId,
        activity_type: ActivityType.SUBMISSION_VERSION_TRANSITION_STARTED,
        submission_id: existing.submission.id,
        submission_version_id: existing.id,
        transition,
      },
      select: { id: true },
    });

    return row;
  });

  if (jobType) {
    try {
      await enqueueAndDispatchJob({
        job_id: jobId,
        job_type: jobType.toUpperCase(),
        payload: {
          site_id: existing.submission.site_id,
          user_id: userId,
          submission_version_id: updated.id,
          cdn: existing.work_version.cdn,
          key: existing.work_version.cdn_key,
          ...transition.options,
          date_published: transition.options?.setsPublishedDate ? datePublished : undefined,
          updates_slug: transition.options?.updatesSlug,
        },
        invoked_by_id: userId,
      });
    } catch (err) {
      // Revert transitioning state so the submission is not stuck if dispatch fails.
      await prisma.submissionVersion.update({
        where: { id: existing.id },
        data: {
          transition: existing.transition ?? undefined,
          date_modified: new Date().toISOString(),
        },
      });
      throw err;
    }
  }

  return updated;
}

async function performSimpleTransition(
  ctx: SiteContext,
  existing: LatestSubmissionVersionDBO,
  targetStateName: string,
  transition: WorkflowTransition,
  datePublished: string,
) {
  const prisma = await getPrismaClient();
  // within a prisma transaction
  return prisma.$transaction(async (tx) => {
    // Update the submission version status
    const timestamp = new Date().toISOString();
    const updated = await tx.submissionVersion.update({
      where: { id: existing.id },
      data: {
        status: targetStateName,
        transition: undefined,
        date_published: transition.options?.setsPublishedDate ? datePublished : undefined,
        date_modified: timestamp,
      },
      select: submissionVersionTransitionUpdateSelect,
    });

    // Handle slug updates based on transition properties
    if (transition.options?.updatesSlug) {
      await slugs.apply(ctx, existing, tx);
    }

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by_id: ctx.user!.id,
        activity_type: ActivityType.SUBMISSION_VERSION_STATUS_CHANGE,
        submission_id: existing.submission.id,
        submission_version_id: existing.id,
        status: targetStateName,
        transition,
      },
      select: { id: true },
    });

    return updated;
  });
}

/**
 * Transitions a submission version to a new state within a workflow.
 *
 * This function handles the transition of a submission version from its current state to a target state
 * within a defined workflow. It performs several important checks and operations:
 *
 * 1. Authentication & Authorization:
 *    - Checks if the transition is valid according to workflow rules
 *    - Validates user has required scopes for the transition
 *
 * 2. Transition Types:
 *    - Simple Transitions: Direct state changes that happen immediately
 *    - Job-Based Transitions: Complex transitions that require background processing
 *
 * 3. Date Handling:
 *    - Preserves existing publication date if present
 *    - Uses provided date if no existing date
 *    - Falls back to current date if neither exists
 *
 * @param ctx - Site context containing user and site information
 * @param existing - Current submission version to transition
 * @param workflow - Workflow definition containing states and transitions
 * @param targetStateName - Desired target state for the transition
 * @param date - Optional publication date (won't override existing dates)
 * @returns Updated submission version after transition
 * @throws {Error} 401 if user is not authenticated
 * @throws {Error} 400 if transition is invalid
 * @throws {Error} 401 if user lacks required permissions
 * @throws {Error} 500 if workflow validation fails
 */
export default async function transitionSubmissionVersion(
  ctx: SiteContext,
  existing: LatestSubmissionVersionDBO,
  workflow: Workflow,
  targetStateName: string,
  /** date will not replace an existing date_published */
  date?: string,
) {
  if (!ctx.user) throw error401('User is not authenticated');

  if (!canTransitionTo(workflow, existing.status, targetStateName)) {
    throw httpError(400, `Cannot transition from ${existing.status} to ${targetStateName}`);
  }

  const transition = getValidTransition(workflow, existing.status, targetStateName);
  if (!transition) {
    console.error(
      'Cannot find a valid transition even though canTransitionTo returned true',
      workflow,
      existing.status,
      targetStateName,
    );
    throw httpError(
      500,
      `Cannot find a valid transition even though canTransitionTo returned true: ${existing.status} -> ${targetStateName}`,
    );
  }

  // Check permissions based on transition properties
  if (!userHasScopes(ctx.user, transition.requiredScopes, ctx.site.name)) {
    throw error403(
      `User does not have required scopes for transition [${transition.name}: ${transition.requiredScopes.join(', ')}]`,
    );
  }

  const isJobBasedTransition = transition.requiresJob;

  const datePublished = existing.date_published ?? date ?? hyphenatedFromDate(new Date());

  if (isJobBasedTransition) {
    return startJobBasedTransition(ctx, existing, transition, datePublished);
  } else {
    const sv = await performSimpleTransition(
      ctx,
      existing,
      targetStateName,
      transition,
      datePublished,
    );
    const submissionUrl = asSiteSubmissionUrl(ctx.asBaseUrl, ctx.site.name, sv.submission.id);
    await ctx.sendSlackNotification({
      eventType: SlackEventType.SUBMISSION_STATUS_CHANGED,
      message: `Submission status changed to ${targetStateName}`,
      user: { id: ctx.user.id },
      metadata: {
        status: targetStateName,
        site: ctx.site.name,
        submissionId: sv.submission.id,
        submissionVersionId: sv.id,
        submissionUrl,
      },
    });
    return sv;
  }
}
