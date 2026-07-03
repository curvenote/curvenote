import type { EnqueueJobParams } from '@curvenote/scms-core';
import { error401, httpError, KnownJobTypes } from '@curvenote/scms-core';
import { getUserById } from '../../context.server.js';
import { assertSitePublishingScopesForUser } from '../handlers/utils.server.js';

const PUBLISHING_JOB_TYPES: ReadonlySet<string> = new Set([
  KnownJobTypes.PUBLISH,
  KnownJobTypes.UNPUBLISH,
]);

async function assertPublishingJobScope(
  jobType: string,
  payload: Record<string, unknown> | undefined,
  invokedById: string | undefined,
): Promise<void> {
  if (!PUBLISHING_JOB_TYPES.has(jobType)) {
    return;
  }

  if (!invokedById) {
    throw error401('Publishing jobs require invoked_by_id');
  }

  const submission_version_id = payload?.submission_version_id;
  if (typeof submission_version_id !== 'string') {
    throw httpError(400, 'payload.submission_version_id is required for publish/unpublish jobs');
  }

  const user = await getUserById(invokedById);
  await assertSitePublishingScopesForUser(user, submission_version_id);
}

/**
 * Enqueue-time scope check for PUBLISH / UNPUBLISH — covers the parent job
 * and any dependents. Dependents inherit the parent's invoked_by_id and are
 * dispatched via a handshake token that carries no scope information, so a
 * PUBLISH/UNPUBLISH dependent must be checked here too, against its own
 * payload.submission_version_id, or it would reach its handler unchecked.
 * Other job types are not gated here — POST /v1/jobs still requires an authenticated user.
 */
export async function validateEnqueuePublishingScopes(params: EnqueueJobParams): Promise<void> {
  await assertPublishingJobScope(params.job_type, params.payload, params.invoked_by_id);
  for (const dependent of params.dependents ?? []) {
    await assertPublishingJobScope(dependent.job_type, dependent.payload, params.invoked_by_id);
  }
}
