import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { withAppSiteContext } from '@curvenote/scms-server';
import { site as siteScopes } from '@curvenote/scms-core';
import { getSiteWithAppData } from '../../backend/db.server.js';
import { dbCountSubmissionsByQueueForSite } from '../$siteName.submissions._index/db.server.js';

/**
 * Resource route for lazy queue totals on the submissions index.
 *
 * JSON-only, no default export. Contract:
 *   GET /app/sites/:siteName/submissions/queue-counts
 *     200 -> { counts: QueueSubmissionCounts }
 *     404 -> { error } (queues disabled for site)
 *
 * Auth matches the version-timeline resource: plain HTTP statuses, no redirect.
 */
export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list]);

  const siteWithAppData = await getSiteWithAppData(ctx.site.name);
  if (!siteWithAppData?.data?.queuesEnabled) {
    return data({ error: 'Queues not enabled for this site' }, { status: 404 });
  }

  const counts = await dbCountSubmissionsByQueueForSite(ctx);
  return data({ counts });
}
