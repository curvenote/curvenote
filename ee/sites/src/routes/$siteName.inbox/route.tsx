import { withAppSiteContext } from '@curvenote/scms-server';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  site as siteScopes,
} from '@curvenote/scms-core';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
<<<<<<< HEAD
import { formatSubmissionListingSiteContext } from '../$siteName.submissions._index/site-context.format.server.js';
import type { SubmissionListingSiteContext } from '../$siteName.submissions._index/site-context.format.server.js';
import { InboxComingSoon } from './InboxComingSoon.js';
=======
import { formatSubmissionListingSiteContext } from '../$siteName.submissions-classic/site-context.format.server.js';
import type { SubmissionListingSiteContext } from '../$siteName.submissions-classic/site-context.format.server.js';
import { dbGetInboxHeadlineStats, dbListInboxActivities } from './db.server.js';
import { INBOX_ACTIVITY_INITIAL, parseInboxPeriod } from './inboxParams.js';
import { InboxDashboard } from './InboxDashboard.js';
>>>>>>> d8efdbc3 (📬 Add inbox overview and activity feed with ui.Card sections)

interface LoaderData {
  site: SubmissionListingSiteContext;
  headlineStats: Awaited<ReturnType<typeof dbGetInboxHeadlineStats>>;
  activityPage: Awaited<ReturnType<typeof dbListInboxActivities>>;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const url = new URL(args.request.url);
  const period = parseInboxPeriod(url.searchParams.get('period'));

  const [headlineStats, activityPage] = await Promise.all([
    dbGetInboxHeadlineStats(ctx, period),
    dbListInboxActivities(ctx, { offset: 0, limit: INBOX_ACTIVITY_INITIAL }),
  ]);

  return {
    site: formatSubmissionListingSiteContext(ctx),
    headlineStats,
    activityPage,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Inbox', loaderData?.site?.title, branding.title) }];
};

export default function Inbox({ loaderData }: { loaderData: LoaderData }) {
  const { site, headlineStats, activityPage } = loaderData;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: site.title || site.name, isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Inbox"
      subtitle={`Manage the submissions inbox for ${site.title}`}
      breadcrumbs={breadcrumbs}
    >
      <InboxDashboard
        siteName={site.name}
        headlineStats={headlineStats}
        activityPage={activityPage}
      />
    </PageFrame>
  );
}
