import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { withAppSiteContext } from '@curvenote/scms-server';
import { site as siteScopes } from '@curvenote/scms-core';
import { z } from 'zod';
import { dbListInboxActivities } from '../$siteName.inbox/db.server.js';
import { INBOX_ACTIVITY_PAGE_SIZE } from '../$siteName.inbox/inboxParams.js';

const ActivityQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(INBOX_ACTIVITY_PAGE_SIZE),
});

/**
 * Resource route for paginated inbox activity.
 *
 *   GET /app/sites/:siteName/inbox/activity?offset=0&limit=5
 *     200 -> { activities: InboxActivityItem[]; hasMore: boolean }
 */
export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list]);

  const url = new URL(args.request.url);
  const query = ActivityQuerySchema.parse({
    offset: url.searchParams.get('offset') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  const page = await dbListInboxActivities(ctx, query);

  return data({
    activities: page.items,
    hasMore: page.hasMore,
    offset: query.offset,
    limit: query.limit,
  });
}
