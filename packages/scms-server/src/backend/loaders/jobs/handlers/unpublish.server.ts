import type { CreateJob } from '@curvenote/scms-core';
import { dbCreateJob, dbUpdateJob } from './db.server.js';
import { validate } from '../../../../api.schemas.js';
import type { PublishJobResults } from './schemas.server.js';
import { CreatePublishJobPayloadSchema } from './schemas.server.js';
import { JobStatus } from '@prisma/client';
import type { StorageBackend } from '../../../storage/index.js';
import { KnownBuckets } from '../../../storage/constants.server.js';
import { httpError } from '@curvenote/scms-core';
import { updateCdnOnWorkVersion, validateSitePublishingScopes } from './utils.server.js';
import type { Context } from '../../../context.server.js';
import { $updateSubmissionVersion } from '../../../db.server.js';
import { SlackEventType } from '../../../services/slack.server.js';
import { getPrismaClient } from '../../../prisma.server.js';

export async function unpublishHandler(
  ctx: Context,
  data: CreateJob,
  storageBackend?: StorageBackend,
) {
  const { submission_version_id, cdn, key, user_id } = validate(
    CreatePublishJobPayloadSchema,
    data.payload,
  );

  await validateSitePublishingScopes(ctx, submission_version_id);

  if (!storageBackend) {
    throw httpError(500, 'Storage backend is required for unpublish operations');
  }

  const created = await dbCreateJob({ ...data, status: JobStatus.RUNNING });

  // setup storage
  const sourceBucket = storageBackend.knownBucketFromCDN(cdn);
  storageBackend.ensureConnection(sourceBucket);

  let results: PublishJobResults = { key, files_transfered: false };
  // check current location, if is in the pub bucket, then we should remove it
  if (storageBackend.knownBucketFromCDN(cdn) === KnownBuckets.pub) {
    // we think it is in the pub bucket, let's check that it is
    const pubFolder = storageBackend.createFolder(key, KnownBuckets.pub);
    const pubExists = await pubFolder.exists();
    if (pubExists) {
      await dbUpdateJob(created.id, {
        status: JobStatus.RUNNING,
        message: 'Found the work version in the pub bucket',
        results,
      });
      // if there is a copy on the prv bucket, remove it from pub
      const prvFolder = storageBackend.createFolder(key, KnownBuckets.prv);
      const prvExists = await prvFolder.exists();
      if (prvExists) {
        try {
          // remove public copy
          await pubFolder.delete();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          return dbUpdateJob(created.id, {
            status: JobStatus.FAILED,
            message: 'Error removing public copy',
            results,
          });
        }
      } else {
        try {
          // else move it to the prv bucket
          await pubFolder.move({ bucket: KnownBuckets.prv, path: key });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          return dbUpdateJob(created.id, {
            status: JobStatus.FAILED,
            message: 'Error moving public copy to prv bucket',
            results,
          });
        }
      }
      results.files_transfered = true;
      await dbUpdateJob(created.id, {
        status: JobStatus.RUNNING,
        message: 'Files transferred to new location',
        results,
      });
    } else {
      await dbUpdateJob(created.id, {
        status: JobStatus.RUNNING,
        message: 'No work version found in the pub bucket',
        results,
      });
      // check for a copy in the prv bucket, if no copy then error!
      const prvFolder = storageBackend.createFolder(key, KnownBuckets.prv);
      const prvExists = await prvFolder.exists();
      if (!prvExists) {
        const message =
          'Cannot Unpublish - No copy of the work version exists in the pub or prv bucket';
        await dbUpdateJob(created.id, {
          status: JobStatus.FAILED,
          message,
          results,
        });
        throw httpError(422, message);
      }
      results.files_transfered = true;
      await dbUpdateJob(created.id, {
        status: JobStatus.RUNNING,
        message: 'Work version found in prv bucket',
        results,
      });
    }

    // update the work version to point to the prv bucket
    let prvCdn = storageBackend.cdnFromKnownBucket(KnownBuckets.prv);
    if (!prvCdn) throw httpError(500, 'Private CDN not registered');
    if (!prvCdn?.endsWith('/')) prvCdn += '/';

    await updateCdnOnWorkVersion(submission_version_id, prvCdn, created.id, results);
  }

  // update the submission to UNPUBLISHED
  try {
    await $updateSubmissionVersion(user_id, submission_version_id, {
      status: 'UNPUBLISHED',
      transition: undefined, // clear the transition
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
  const prisma = await getPrismaClient();
  const sv = await prisma.submissionVersion.findFirst({
    where: { id: submission_version_id },
    include: { submission: { include: { site: { select: { name: true } } } } },
  });
  await ctx.sendSlackNotification({
    eventType: SlackEventType.SUBMISSION_STATUS_CHANGED,
    message: `Submission status changed to UNPUBLISHED`,
    user: { id: user_id },
    metadata: {
      status: 'UNPUBLISHED',
      site: sv?.submission?.site?.name,
      submissionId: sv?.submission?.id,
      submissionVersionId: submission_version_id,
    },
  });

  results = { ...results, submission_updated: true };
  return dbUpdateJob(created.id, {
    status: JobStatus.COMPLETED,
    message: 'Unpublishing complete.',
    results,
  });
}
