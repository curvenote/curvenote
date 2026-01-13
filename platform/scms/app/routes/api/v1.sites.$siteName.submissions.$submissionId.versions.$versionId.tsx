import type { Route } from './+types/v1.sites.$siteName.submissions.$submissionId.versions.$versionId';
import { httpError, site, work } from '@curvenote/scms-core';
import { withCurvenoteSubmissionContext, sites } from '@curvenote/scms-server';

/**
 * GET v1/sites/$siteName/submissions/$submissionId/versions/$versionId
 *
 * Get a submission version by id - no anonymous (reader) access needed
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withCurvenoteSubmissionContext(args, [
    work.submissions.read,
    site.submissions.read,
  ]);
  const { versionId } = args.params;
  if (!versionId) throw httpError(400, 'Missing version ID');
  const dto = await sites.submissions.versions.get(ctx, versionId);
  return Response.json(dto);
}
