import {
  ensureJsonBodyFromMethod,
  validate,
  getPrismaClient,
  $updateSubmissionVersion,
  SlackEventType,
  withAPISubmissionContext,
  sites,
} from '@curvenote/scms-server';
import { type ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { $Enums } from '@curvenote/scms-db';
import { site, error401 } from '@curvenote/scms-core';
import { extensions } from '../../extensions/server';

const SubmissionStatusUpdateSchema = z.object({
  status: z.string(),
  userId: z.string(),
});

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAPISubmissionContext(args, [site.submissions.update], {
    allowHandshake: true,
  });

  // Directly updating the status is only allowed by direct call from a trusted job
  if (!ctx.authorized.handshake || !ctx.claims.handshake?.jobId) throw error401('Unauthorized');

  const jobId = ctx.claims.handshake.jobId;
  const prisma = await getPrismaClient();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      SubmissionVersion: {
        include: {
          submission: {
            include: {
              submitted_by: true,
            },
          },
        },
      },
    },
  });

  // The handshake token must also declare a running jobId that corresponds to the submission in the path
  if (!job || job.status !== $Enums.JobStatus.RUNNING) {
    throw error401('Unauthorized');
  }
  if (!job.SubmissionVersion || job.SubmissionVersion.submission.id !== ctx.submission.id) {
    throw error401('Unauthorized');
  }

  const body = await ensureJsonBodyFromMethod(args.request, ['PUT']);
  const { status, userId } = validate(SubmissionStatusUpdateSchema, body);

  // Status is not validated against the current transition; we trust the job to set the correct status
  await $updateSubmissionVersion(userId, job.SubmissionVersion.id, {
    status,
    transition: undefined, // clear the transition
    jobId, // record the job.id for posterity (later this should be stashed on the activity)
  });

  await ctx.sendSlackNotification({
    eventType: SlackEventType.SUBMISSION_STATUS_CHANGED,
    message: `Submission status changed to ${status}`,
    user: { id: userId },
    metadata: {
      status,
    },
  });

  const dto = await sites.submissions.formatSubmissionDTO(ctx, ctx.submission, extensions);
  return Response.json(dto);
}
