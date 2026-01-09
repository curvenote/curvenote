import type { Route } from './+types/v1.sites.$siteName.submissions.$submissionId';
import { site, work } from '@curvenote/scms-core';
import { withCurvenoteSubmissionContext } from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

/**
 *
 * GET v1/sites/$siteName/submissions/$submissionId
 *
 * Get a submission by id - no anonymous (reader) access needed
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withCurvenoteSubmissionContext(args, [
    work.submissions.read,
    site.submissions.read,
  ]);
  return Response.json(await ctx.submissionDTO(extensions));
}
