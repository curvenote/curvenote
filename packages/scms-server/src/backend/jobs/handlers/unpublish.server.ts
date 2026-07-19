import type { CreateJob } from '@curvenote/scms-core';
import { dbStartJob, dbUpdateJob } from './db.server.js';
import { validate } from '../../../api.schemas.js';
import type { PublishJobResults } from './schemas.server.js';
import { CreatePublishJobPayloadSchema } from './schemas.server.js';
import { JobStatus } from '@curvenote/scms-db';
import type { StorageBackend } from '../../storage/index.js';
import { KnownBuckets } from '../../storage/constants.server.js';
import { httpError, asSiteSubmissionUrl } from '@curvenote/scms-core';
import { updateCdnOnWorkVersion, validateSitePublishingScopes } from './utils.server.js';
import type { Context } from '../../context.server.js';
import { $updateSubmissionVersion } from '../../db.server.js';
import { SlackEventType } from '../../services/slack.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { createFolder } from '../../storage/folder.server.js';

export async function unpublishHandler(
  ctx: Context,
  data: CreateJob,
  storageBackend?: StorageBackend,
) {
  const { submission_version_id, cdn, key, user_id } = validate(
    CreatePublishJobPayloadSchema,
    data.payload,
  );

  console.log('[unpublishHandler] start', {
    job_id: data.id,
    submission_version_id,
    user_id,
    cdn,
    key,
    has_storage_backend: Boolean(storageBackend),
  });

  await validateSitePublishingScopes(ctx, submission_version_id);

  if (!storageBackend) {
    throw httpError(500, 'Storage backend is required for unpublish operations');
  }

  const jobId = data.id;
  await dbStartJob({ ...data, status: JobStatus.RUNNING });

  // setup storage
  const sourceBucket = storageBackend?.knownBucketFromCDN(cdn) ?? null;
  const isManagedCdn = Boolean(storageBackend && sourceBucket);
  console.log('[unpublishHandler] storage plan', {
    job_id: data.id,
    source_bucket: sourceBucket,
    is_managed_cdn: isManagedCdn,
    cdn,
    key,
  });
  if (isManagedCdn) {
    storageBackend!.ensureConnection(sourceBucket as any);
  }

  let results: PublishJobResults = { key, files_transfered: false };
  // check current location, if is in the pub bucket, then we should remove it
  if (isManagedCdn && sourceBucket === KnownBuckets.pub) {
    // we think it is in the pub bucket, let's check that it is
    const pubFolder = createFolder(storageBackend, key, KnownBuckets.pub);
    const pubExists = await pubFolder.exists();
    const prvFolder = createFolder(storageBackend, key, KnownBuckets.prv);
    const prvExistsBefore = await prvFolder.exists();
    console.log('[unpublishHandler] pub bucket branch', {
      job_id: data.id,
      key,
      pub_exists: pubExists,
      prv_exists: prvExistsBefore,
    });
    if (pubExists) {
      await dbUpdateJob(jobId, {
        status: JobStatus.RUNNING,
        message: 'Found the work version in the pub bucket',
        results,
      });
      // if there is a copy on the prv bucket, remove it from pub
      if (prvExistsBefore) {
        try {
          console.log('[unpublishHandler] deleting pub copy (prv already exists)', {
            job_id: data.id,
            key,
          });
          await pubFolder.delete();
        } catch (error) {
          console.warn('[unpublishHandler] delete pub copy failed', {
            job_id: data.id,
            key,
            error,
          });
          return dbUpdateJob(jobId, {
            status: JobStatus.FAILED,
            message: 'Error removing public copy',
            results,
          });
        }
      } else {
        try {
          console.log('[unpublishHandler] moving pub copy to prv', { job_id: data.id, key });
          await pubFolder.move({ bucket: KnownBuckets.prv, path: key });
        } catch (error) {
          console.warn('[unpublishHandler] move pub to prv failed', {
            job_id: data.id,
            key,
            error,
          });
          return dbUpdateJob(jobId, {
            status: JobStatus.FAILED,
            message: 'Error moving public copy to prv bucket',
            results,
          });
        }
      }
      results.files_transfered = true;
      await dbUpdateJob(jobId, {
        status: JobStatus.RUNNING,
        message: 'Files transferred to new location',
        results,
      });
    } else {
      await dbUpdateJob(jobId, {
        status: JobStatus.RUNNING,
        message: 'No work version found in the pub bucket',
        results,
      });
      // check for a copy in the prv bucket, if no copy then error!
      const prvExists = prvExistsBefore;
      console.log('[unpublishHandler] no pub copy; checking prv only', {
        job_id: data.id,
        key,
        prv_exists: prvExists,
      });
      if (!prvExists) {
        const message =
          'Cannot Unpublish - No copy of the work version exists in the pub or prv bucket';
        console.warn('[unpublishHandler] no storage copy', {
          job_id: data.id,
          key,
          pub_bucket: KnownBuckets.pub,
          prv_bucket: KnownBuckets.prv,
        });
        await dbUpdateJob(jobId, {
          status: JobStatus.FAILED,
          message,
          results,
        });
        throw httpError(422, message);
      }
      results.files_transfered = true;
      await dbUpdateJob(jobId, {
        status: JobStatus.RUNNING,
        message: 'Work version found in prv bucket',
        results,
      });
    }

    // update the work version to point to the prv bucket
    let prvCdn = storageBackend!.cdnFromKnownBucket(KnownBuckets.prv);
    if (!prvCdn) throw httpError(500, 'Private CDN not registered');
    if (!prvCdn?.endsWith('/')) prvCdn += '/';

    console.log('[unpublishHandler] updating work version cdn', {
      job_id: data.id,
      submission_version_id,
      prv_cdn: prvCdn,
    });
    await updateCdnOnWorkVersion(submission_version_id, prvCdn, jobId, results);
  } else if (isManagedCdn) {
    console.log('[unpublishHandler] skipping file moves (cdn not on pub bucket)', {
      job_id: data.id,
      source_bucket: sourceBucket,
      cdn,
    });
  }

  // update the submission to UNPUBLISHED
  try {
    await $updateSubmissionVersion(user_id, submission_version_id, {
      status: 'UNPUBLISHED',
      transition: undefined, // clear the transition
      jobId: jobId ?? undefined, // clear the jobId
    });
  } catch (error) {
    const message = 'Error updating submission status';
    console.log(message, error);
    await dbUpdateJob(jobId, {
      status: JobStatus.FAILED,
      message,
      results,
    });
    throw httpError(422, message, { message, error, submission_version_id });
  }
  const prisma = await getPrismaClient();
  const sv = await prisma.submissionVersion.findFirst({
    where: { id: submission_version_id },
    select: {
      id: true,
      submission_id: true,
      submission: {
        select: {
          id: true,
          site: { select: { name: true } },
        },
      },
    },
  });
  const siteName = sv?.submission?.site?.name;

  await ctx.sendSlackNotification({
    eventType: SlackEventType.SUBMISSION_STATUS_CHANGED,
    message: 'Submission status changed to UNPUBLISHED',
    user: { id: user_id },
    metadata: {
      status: 'UNPUBLISHED',
      site: siteName,
      submissionId: sv?.submission?.id ?? 'unknown',
      submissionVersionId: submission_version_id ?? 'unknown',
      submissionUrl: asSiteSubmissionUrl(ctx.asBaseUrl, siteName, sv?.submission?.id),
    },
  });

  results = { ...results, submission_updated: true };
  console.log('[unpublishHandler] complete', {
    job_id: data.id,
    submission_version_id,
    results,
  });
  return dbUpdateJob(jobId, {
    status: JobStatus.COMPLETED,
    message: 'Unpublishing complete.',
    results,
  });
}
