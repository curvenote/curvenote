import type { Route } from './+types/v1.sites.$siteName.submissions.$submissionId.versions.$versionId';
import { httpError, site, work } from '@curvenote/scms-core';
import { sites } from '@curvenote/scms-server';

/**
 * GET v1/sites/$siteName/submissions/$submissionId/versions/$versionId
 *
 * Get a submission version by id - no anonymous (reader) access needed
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await sites.submissions.withCurvenoteSubmissionReadSiteContext(args, [
    work.id.submissions.read,
    site.submissions.read,
  ]);

  const submissionId = args.params.submissionId;
  const versionId = args.params.versionId;
  if (!submissionId) throw httpError(400, 'Missing submission id');
  if (!versionId) throw httpError(400, 'Missing version ID');

  const dto = await sites.submissions.versions.getOnSubmission(ctx, submissionId, versionId);
  return Response.json(dto);
}
