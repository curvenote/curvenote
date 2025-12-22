import type { Context } from '../../../context.server.js';
import type { CreateJob, SubmissionPublishedEmailProps } from '@curvenote/scms-core';
import { JobStatus } from '@prisma/client';
import { dbCreateJob, dbUpdateJob } from './db.server.js';
import type { StorageBackend } from '../../../storage/index.js';
import { KnownBuckets } from '../../../storage/constants.server.js';
import { validate } from '../../../../api.schemas.js';
import type { PublishJobResults } from './schemas.server.js';
import { CreatePublishJobPayloadSchema } from './schemas.server.js';
import * as slugs from '../../../loaders/sites/submissions/slugs.server.js';
import { httpError, KnownResendEvents } from '@curvenote/scms-core';
import { updateCdnOnWorkVersion, validateSitePublishingScopes } from './utils.server.js';
import { SiteContext } from '../../../context.site.server.js';
import { $updateSubmissionVersion } from '../../../db.server.js';
import { SlackEventType } from '../../../services/slack.server.js';
import { createSiteRootUrl } from '../../../domains.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import type { TemplatedResendEmail } from '../../../services/emails/resend.server.js';

/**
 * Publish a submission version to the public CDN
 * @param ctx - The context object
 * @param data - The job creation data object containing:
 *   - id: string - UUID of the job
 *   - job_type: string - Type of job (should be PUBLISH)
 *   - payload: {
 *       site_id: string - UUID of the site
 *       user_id: string - ID of the user initiating the publish
 *       submission_version_id: string - UUID of the submission version to publish
 *       cdn: string - URL of the source CDN
 *       key: string - UUID of the content to publish
 *     }
 *   - status?: JobStatus - Optional initial status
 *   - results?: Record<string, any> - Optional initial results
 * @param storageBackend - The storage backend to use for file operations
 * @returns The updated job
 */
export async function publishHandler(
  ctx: Context,
  data: CreateJob,
  storageBackend?: StorageBackend,
) {
  const { submission_version_id, cdn, key, user_id, date_published, updates_slug } = validate(
    CreatePublishJobPayloadSchema,
    data.payload,
  );

  await validateSitePublishingScopes(ctx, submission_version_id);

  if (!storageBackend) {
    throw httpError(500, 'Storage backend is required for publish operations');
  }

  const created = await dbCreateJob({ ...data, status: JobStatus.RUNNING });
  // currently implemented as a long running task in the job response handler
  // must complete before a response is sent, could be moved to another endpoint if needed
  // as we create a job to start with clients/callers can fire-and-forget if they choose

  const sourceBucket = storageBackend.knownBucketFromCDN(cdn);
  storageBackend.ensureConnection(sourceBucket);

  // check source file location
  const folder = storageBackend.createFolder(key, sourceBucket);
  const exists = await folder.exists();
  if (!exists) {
    // TODO: on failures we need to clear transitions, and log an activity indicating failure and preserving the jobId
    const message = `Folder does not exist ${cdn}/${key}`;
    console.warn(message);
    await dbUpdateJob(created.id, {
      status: JobStatus.FAILED,
      message,
      results: { files_transfered: false },
    });
    throw httpError(422, message);
  }

  // copy files to new location
  let results: PublishJobResults = {
    cdn,
    key,
    files_transfered: false,
    date_published_updated: false,
    slug_updated: false,
  };
  try {
    await folder.copy({ bucket: KnownBuckets.pub, path: key });
    results = { files_transfered: true };
    await dbUpdateJob(created.id, {
      status: JobStatus.RUNNING,
      message: 'Files transferred to new location',
      results,
    });
  } catch (error) {
    const message = 'Error copying folder';
    console.log(message, error);
    await dbUpdateJob(created.id, {
      status: JobStatus.FAILED,
      message,
      results,
    });
    throw httpError(422, message, { message, error });
  }

  let newCdn = storageBackend.cdnFromKnownBucket(KnownBuckets.pub);
  if (!newCdn) throw httpError(500, 'Public CDN not registered');
  if (!newCdn?.endsWith('/')) newCdn += '/';

  // update submission's work version with new cdn details
  await updateCdnOnWorkVersion(submission_version_id, newCdn, created.id, results);

  // update submission status to PUBLISHED
  let updated: Awaited<ReturnType<typeof $updateSubmissionVersion>>;
  try {
    updated = await $updateSubmissionVersion(user_id, submission_version_id, {
      status: 'PUBLISHED',
      transition: undefined, // clear the transition
      date_published: date_published,
      jobId: created.id ?? undefined, // clear the jobId
    });
  } catch (error) {
    const message = 'Error updating submission status';
    console.log(message, error);
    await dbUpdateJob(created.id, {
      status: JobStatus.FAILED,
      message,
      results,
    });
    throw httpError(422, message, { message, error, submission_version_id });
  }

  // TODO: update from job
  // Handle slug updates based on transition properties
  if (updates_slug) {
    await slugs.apply(new SiteContext(ctx, updated.submission.site), updated);
    results = { ...results, slug_updated: true };
  }
  const siteUrl = ctx.$config.app?.renderServiceUrl ?? createSiteRootUrl(updated.submission.site);
  const slug =
    updated.submission.slugs.find((s) => s.primary)?.slug ?? updated.work_version.work_id;
  const url = `${siteUrl}/articles/${slug}`;
  await ctx.sendSlackNotification({
    eventType: SlackEventType.SUBMISSION_STATUS_CHANGED,
    message: `Submission status changed to PUBLISHED`,
    user: { id: user_id },
    metadata: {
      url,
      status: 'PUBLISHED',
      site: updated.submission?.site?.name,
      submissionId: updated.submission?.id,
      submissionVersionId: submission_version_id,
    },
  });
  // Only send email if this is the only published version for the submission
  const prisma = await getPrismaClient();
  const allPublishedVersions = await prisma.submissionVersion.findMany({
    where: {
      submission: {
        id: updated.submission_id,
      },
      status: 'PUBLISHED',
    },
  });
  if (allPublishedVersions.length === 1) {
    const emails: TemplatedResendEmail<
      typeof KnownResendEvents.SUBMISSION_PUBLISHED,
      SubmissionPublishedEmailProps
    >[] = [];
    updated.work_version.author_details?.forEach((author) => {
      if (
        author &&
        typeof author === 'object' &&
        'email' in author &&
        typeof author.email === 'string'
      ) {
        emails.push({
          eventType: KnownResendEvents.SUBMISSION_PUBLISHED,
          to: author.email,
          subject: `🎉 Congratulations on publishing to ${updated.submission.site.title}!`,
          templateProps: {
            submissionTitle: updated.work_version.title,
            siteTitle: updated.submission.site.title,
            publishedUrl: url,
            authorName: author.name as string | undefined,
          },
        });
      }
    });
    await ctx.sendEmailBatch(emails);
  }
  results = { ...results, submission_updated: true, date_published_updated: !!date_published };
  const job = await dbUpdateJob(created.id, {
    status: JobStatus.COMPLETED,
    message: 'Publishing complete.',
    results,
  });

  return job;
}
