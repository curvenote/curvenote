import { $Enums } from '@curvenote/scms-db';
import {
  error401,
  error403,
  httpError,
  hyphenatedFromDate,
  canTransitionTo,
  getValidTransition,
  getJobType,
} from '@curvenote/scms-core';
import { getPrismaClient } from '../../../../prisma.server.js';
import { userHasScopes } from '../../../../scopes.helpers.server.js';
import * as slugs from '../slugs.server.js';
import type { SiteContext } from '../../../../context.site.server.js';
import { waitUntil } from '@vercel/functions';
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
    include: {
      submitted_by: true,
      submission: {
        include: {
          kind: true,
          collection: true,
          work: true,
        },
      },
      work_version: {
        include: {
          work: true,
        },
      },
    },
  });
}

type LatestSubmissionVersionDBO = NonNullable<
  Awaited<ReturnType<typeof dbGetLatestSubmissionVersionFromSubmission>>
>;

// TODO tighten up the final DTO on the publish/unpublish endpoints in order to
// reduce the scale of this query
const include = {
  submission: {
    include: {
      kind: true,
      collection: true,
      work: true,
      activity: {
        include: {
          activity_by: true,
          submission_version: true,
          work_version: true,
          kind: true,
        },
      },
      site: { include: { submissionKinds: true, domains: true, collections: true } },
      versions: {
        include: {
          work_version: {
            include: {
              work: true,
            },
          },
          submitted_by: true,
        },
      },
      slugs: true,
      submitted_by: true,
    },
  },
  work_version: {
    include: {
      work: true,
    },
  },
  submitted_by: true,
};

async function startJobBasedTransition(
  ctx: SiteContext,
  existing: LatestSubmissionVersionDBO,
  transition: WorkflowTransition,
  datePublished: string,
) {
  const prisma = await getPrismaClient();
  // within a prisma transaction
  return prisma.$transaction(async (tx) => {
    // Update the submission version with the transition information
    const jobId = uuidv7();
    const statefulTransition = {
      ...transition,
      state: {
        ...transition.state,
        jobId,
      },
    };
    const timestamp = new Date().toISOString();
    const updated = await tx.submissionVersion.update({
      where: { id: existing.id },
      data: {
        transition: statefulTransition,
        date_modified: timestamp,
      },
      include,
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by_id: ctx.user!.id,
        activity_type: $Enums.ActivityType.SUBMISSION_VERSION_TRANSITION_STARTED,
        submission_id: existing.submission.id,
        submission_version_id: existing.id,
        transition,
      },
    });

    // Handle job creation based on transition properties
    const jobType = getJobType(transition);
    if (jobType) {
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');

      if (ctx.authorized.curvenote && ctx.$verifiedCurvenoteToken) {
        headers.set('Authorization', ctx.$verifiedCurvenoteToken);
      } else if (ctx.authorized.handshake && ctx.$verifiedHandshakeToken) {
        headers.set('Authorization', ctx.$verifiedHandshakeToken);
      } else if (ctx.$verifiedSession && ctx.user) {
        headers.append('Cookie', ctx.request.headers.get('Cookie') ?? '');
      } else {
        throw error401(`Unauthorized - cannot start ${jobType} job without user credentials`);
      }

      // TODO: this is not a background on on vercel! might as well call the handler and lock down /v1/jobs
      waitUntil(
        fetch(ctx.asApiUrl('/jobs'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: jobId,
            job_type: jobType.toUpperCase(),
            payload: {
              site_id: existing.submission.site_id,
              user_id: ctx.user!.id,
              submission_version_id: updated.id,
              cdn: existing.work_version.cdn,
              key: existing.work_version.cdn_key,
              ...transition.options,
              date_published: transition.options?.setsPublishedDate ? datePublished : undefined,
              updates_slug: transition.options?.updatesSlug,
            },
          }),
        }),
      );
    }

    return updated;
  });
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
      include,
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
        activity_type: $Enums.ActivityType.SUBMISSION_VERSION_STATUS_CHANGE,
        submission_id: existing.submission.id,
        submission_version_id: existing.id,
        status: targetStateName,
        transition,
      },
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
    await ctx.sendSlackNotification({
      eventType: SlackEventType.SUBMISSION_STATUS_CHANGED,
      message: `Submission status changed to ${targetStateName}`,
      user: { id: ctx.user.id },
      metadata: {
        status: targetStateName,
        site: sv.submission.site.name,
        submissionId: sv.submission.id,
        submissionVersionId: sv.id,
      },
    });
    return sv;
  }
}
