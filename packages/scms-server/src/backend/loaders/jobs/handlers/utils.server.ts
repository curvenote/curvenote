import { $Enums } from '@curvenote/scms-db';
import { dbUpdateJob } from './db.server.js';
import { error401, httpError, site } from '@curvenote/scms-core';
import { getPrismaClient } from '../../../prisma.server.js';
import type { Context } from '../../../context.server.js';
import { userHasScopes } from '../../../scopes.helpers.server.js';

export async function updateCdnOnWorkVersion(
  submission_version_id: string,
  newCdn: string,
  jobId: string,
  results: Record<string, any>,
) {
  try {
    const prisma = await getPrismaClient();
    const timestamp = new Date().toISOString();
    const wv = await prisma.submissionVersion.update({
      where: {
        id: submission_version_id,
      },
      data: {
        date_modified: timestamp,
        work_version: {
          update: {
            date_modified: timestamp,
            cdn: newCdn,
          },
        },
      },
    });
    if (!wv) throw Error('Work Version not updated');
    results = { ...results, work_version_updated: true, cdn: newCdn };
    await dbUpdateJob(jobId, {
      status: $Enums.JobStatus.RUNNING,
      message: 'Files transferred to new location',
      results,
    });
  } catch (error) {
    const message = 'Error updating work version';
    console.log(message, error);
    await dbUpdateJob(jobId, {
      status: $Enums.JobStatus.FAILED,
      message,
      results,
    });
    throw httpError(422, message, { message, error, submission_version_id });
  }

  return results;
}

// Validating scopes at this point will also secure the API endpoint used by the CLI
// even though we may have an earlier scope check based on the transition properties
// during app driven transitions
//
// here specifically we know that this handler required certain scopes but need the site information
// to validate the scope
export async function validateSitePublishingScopes(ctx: Context, submission_version_id: string) {
  const prisma = await getPrismaClient();
  const sv = await prisma.submissionVersion.findFirst({
    where: { id: submission_version_id },
    include: { submission: { include: { site: { select: { name: true } } } } },
  });
  if (!sv) throw httpError(404, 'Submission version not found');
  if (
    !userHasScopes(ctx.user, [site.submissions.update, site.publishing], sv.submission.site.name)
  ) {
    throw error401();
  }
}
