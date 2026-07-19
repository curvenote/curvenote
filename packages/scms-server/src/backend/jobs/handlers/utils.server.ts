import { JobStatus } from '@curvenote/scms-db';
import { dbUpdateJob } from './db.server.js';
import { error401, httpError, site } from '@curvenote/scms-core';
import { getPrismaClient } from '../../prisma.server.js';
import type { Context } from '../../context.server.js';
import type { UserWithRolesDBO } from '../../db.types.js';
import { userHasScopes } from '../../scopes.helpers.server.js';

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
      select: { id: true },
    });
    if (!wv) throw Error('Work Version not updated');
    results = { ...results, work_version_updated: true, cdn: newCdn };
    await dbUpdateJob(jobId, {
      status: JobStatus.RUNNING,
      message: 'Files transferred to new location',
      results,
    });
  } catch (error) {
    const message = 'Error updating work version';
    console.log(message, error);
    await dbUpdateJob(jobId, {
      status: JobStatus.FAILED,
      message,
      results,
    });
    throw httpError(422, message, { message, error, submission_version_id });
  }

  return results;
}

// Validates site.submissions.update + site.publishing for the submission's site.
// Call at enqueue (validateEnqueuePublishingScopes) with the invoking user.
// Handlers call validateSitePublishingScopes for legacy invoke / direct handler paths.
export async function assertSitePublishingScopesForUser(
  user: UserWithRolesDBO | null | undefined,
  submission_version_id: string,
) {
  const prisma = await getPrismaClient();
  const sv = await prisma.submissionVersion.findFirst({
    where: { id: submission_version_id },
    select: {
      id: true,
      submission: {
        select: {
          site: { select: { name: true } },
        },
      },
    },
  });
  if (!sv) throw httpError(404, 'Submission version not found');
  const siteName = sv.submission.site.name;
  const hasScopes = userHasScopes(user, [site.submissions.update, site.publishing], siteName);
  if (!hasScopes) {
    console.warn('[validateSitePublishingScopes] denied', {
      submission_version_id,
      site: siteName,
      user_id: user?.id ?? null,
      required_scopes: [site.submissions.update, site.publishing],
    });
    throw error401();
  }
}

export async function validateSitePublishingScopes(ctx: Context, submission_version_id: string) {
  // Async queue: scopes were checked at enqueue; handshake only binds job_id + job_type.
  if (ctx.authorized.handshake) {
    console.log('[validateSitePublishingScopes] skip — enqueue-time auth + handshake binding', {
      submission_version_id,
      job_id: ctx.$handshakeClaims?.jobId,
    });
    return;
  }

  await assertSitePublishingScopesForUser(ctx.user, submission_version_id);
}
