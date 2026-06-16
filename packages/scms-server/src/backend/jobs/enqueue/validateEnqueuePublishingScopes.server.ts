import type { EnqueueJobParams } from '@curvenote/scms-core';
import { error401, httpError, KnownJobTypes } from '@curvenote/scms-core';
import { getUserById } from '../../context.server.js';
import { assertSitePublishingScopesForUser } from '../handlers/utils.server.js';

const PUBLISHING_JOB_TYPES: ReadonlySet<string> = new Set([
  KnownJobTypes.PUBLISH,
  KnownJobTypes.UNPUBLISH,
]);

/**
 * Enqueue-time scope check for PUBLISH / UNPUBLISH only.
 * Other job types are not gated here — POST /v1/jobs still requires an authenticated user.
 */
export async function validateEnqueuePublishingScopes(params: EnqueueJobParams): Promise<void> {
  if (!PUBLISHING_JOB_TYPES.has(params.job_type)) {
    return;
  }

  if (!params.invoked_by_id) {
    throw error401('Publishing jobs require invoked_by_id');
  }

  const submission_version_id = params.payload?.submission_version_id;
  if (typeof submission_version_id !== 'string') {
    throw httpError(400, 'payload.submission_version_id is required for publish/unpublish jobs');
  }

  const user = await getUserById(params.invoked_by_id);
  await assertSitePublishingScopesForUser(user, submission_version_id);
}
