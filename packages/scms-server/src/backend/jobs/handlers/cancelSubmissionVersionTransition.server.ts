import { ActivityType, Prisma } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../prisma.server.js';

type CancelTransitionParams = {
  submission_version_id: string;
  job_id: string;
  user_id: string;
  error: string;
  job_type: string;
};

/**
 * Clears an in-flight submission-version transition when a publish/unpublish job fails.
 * Logs activity preserving the failed job id and error message.
 */
export async function cancelSubmissionVersionTransitionOnJobFailure(
  params: CancelTransitionParams,
): Promise<void> {
  const prisma = await getPrismaClient();
  const sv = await prisma.submissionVersion.findUnique({
    where: { id: params.submission_version_id },
    select: {
      id: true,
      status: true,
      transition: true,
      job_id: true,
      submission_id: true,
    },
  });

  if (!sv) {
    console.warn('[cancelSubmissionVersionTransitionOnJobFailure] submission version not found', {
      submission_version_id: params.submission_version_id,
      job_id: params.job_id,
    });
    return;
  }

  if (sv.transition == null) {
    console.log('[cancelSubmissionVersionTransitionOnJobFailure] no transition to cancel', {
      submission_version_id: params.submission_version_id,
      job_id: params.job_id,
    });
    return;
  }

  const transition = sv.transition as Record<string, unknown>;
  const stateJobId =
    transition.state != null &&
    typeof transition.state === 'object' &&
    'jobId' in transition.state &&
    typeof (transition.state as { jobId?: string }).jobId === 'string'
      ? (transition.state as { jobId: string }).jobId
      : undefined;

  if (stateJobId && stateJobId !== params.job_id) {
    console.warn('[cancelSubmissionVersionTransitionOnJobFailure] transition job mismatch', {
      submission_version_id: params.submission_version_id,
      job_id: params.job_id,
      transition_job_id: stateJobId,
    });
    return;
  }

  const timestamp = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.submissionVersion.update({
      where: { id: sv.id },
      data: {
        transition: Prisma.JsonNull,
        ...(sv.job_id === params.job_id ? { job_id: null } : {}),
        date_modified: timestamp,
      },
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by_id: params.user_id,
        activity_type: ActivityType.SUBMISSION_VERSION_STATUS_CHANGE,
        submission_id: sv.submission_id,
        submission_version_id: sv.id,
        status: sv.status,
        transition: transition as Prisma.InputJsonValue,
        data: {
          job_id: params.job_id,
          job_type: params.job_type,
          error: params.error,
          transition_cancelled: true,
        },
      },
      select: { id: true },
    });
  });

  console.log('[cancelSubmissionVersionTransitionOnJobFailure] transition cancelled', {
    submission_version_id: params.submission_version_id,
    job_id: params.job_id,
    job_type: params.job_type,
    error: params.error,
  });
}
