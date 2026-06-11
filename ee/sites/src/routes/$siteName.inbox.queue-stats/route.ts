import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { withAppSiteContext } from '@curvenote/scms-server';
import { site as siteScopes } from '@curvenote/scms-core';
import { getSiteWithAppData } from '../../backend/db.server.js';
import { dbGetInboxQueueStats } from '../$siteName.inbox/db.queue-stats.server.js';

/**
 * Resource route for lazy inbox queue tiles.
 *
 *   GET /app/sites/:siteName/inbox/queue-stats
 *     200 -> { stats: InboxQueueStats }
 *     404 -> { error } (queues disabled for site)
 */
export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list]);

  const siteWithAppData = await getSiteWithAppData(ctx.site.name);
  if (!siteWithAppData?.data?.queuesEnabled) {
    return data({ error: 'Queues not enabled for this site' }, { status: 404 });
  }

  const stats = await dbGetInboxQueueStats(ctx);
  return data({ stats });
}
