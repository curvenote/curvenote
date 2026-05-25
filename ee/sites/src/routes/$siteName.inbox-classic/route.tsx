import type { jobs } from '@curvenote/scms-server';
import { withAppSiteContext } from '@curvenote/scms-server';
import {
  useRevalidateOnInterval,
  PageFrame,
  EmptyMessage,
  site as siteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { useEffect, useState } from 'react';
import { dbGetInboxSubmissions } from './db.server.js';
import { SubmissionList } from '../../components/SubmissionList.js';
import { SiteTrackEvent } from '../../analytics/events.js';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { formatSubmissionListingSiteContext } from '../$siteName.submissions._index/site-context.format.server.js';
import type { SubmissionListingSiteContext } from '../$siteName.submissions._index/site-context.format.server.js';
import type { AugmentedSubmissionListingItem } from '../$siteName.submissions._index/types.js';
type InboxJob = Awaited<ReturnType<typeof jobs.list>>;

interface LoaderData {
  scopes: string[];
  site: SubmissionListingSiteContext;
  groups: Array<{
    status: string;
    items: AugmentedSubmissionListingItem[];
  }>;
  jobs: InboxJob;
  defaultCollectionOnly: boolean;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const { groups, jobs } = await dbGetInboxSubmissions(ctx);

  const totalSubmissions = groups.reduce((sum, group) => sum + group.items.length, 0);

  const userSiteRole =
    ctx.user?.site_roles.find((sr) => sr.site_id === ctx.site.id)?.role || 'none';

  await ctx.trackEvent(SiteTrackEvent.SITE_VIEWED, {
    siteName: ctx.site.name,
    siteType: ctx.site.private ? 'private' : 'public',
    userRole: userSiteRole,
    submissionCount: totalSubmissions,
    pageType: 'inbox-classic',
  });

  await ctx.analytics.flush();

  return {
    scopes: ctx.scopes,
    site: formatSubmissionListingSiteContext(ctx),
    groups,
    jobs,
    defaultCollectionOnly: ctx.site.collections.length === 1 && ctx.site.collections[0].default,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Inbox Classic', loaderData?.site?.title, branding.title) }];
};

export default function InboxClassic({ loaderData }: { loaderData: LoaderData }) {
  const { groups, jobs, defaultCollectionOnly, site, scopes } = loaderData;

  const [enabled, setEnabled] = useState(false);
  useRevalidateOnInterval({ enabled, interval: 3000 });

  useEffect(() => {
    if (jobs.items.length > 0) {
      setEnabled(true);
    } else {
      setEnabled(false);
    }
  }, [jobs]);

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: site.title || site.name, isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Inbox Classic"
      subtitle={`Manage the submissions inbox for ${site.title}`}
      breadcrumbs={breadcrumbs}
    >
      {groups.length === 0 && (
        <div className="space-y-5 lg:space-y-0">
          <EmptyMessage message="No New Submissions" />
        </div>
      )}
      {groups.length > 0 && (
        <div className="space-y-5 lg:space-y-0">
          {groups.map((group) => (
            <div key={group.status}>
              <h1>
                {group.status}{' '}
                {jobs.items?.length > 0 && (
                  <div
                    className="inline-block w-2 h-2 ml-[2px] bg-green-500 rounded align-super animate-pulse"
                    title="polling running jobs..."
                  ></div>
                )}
              </h1>
              <div className="py-5">
                <SubmissionList
                  site={site}
                  scopes={scopes}
                  items={group.items}
                  to={(id: string) => `../submissions/${id}`}
                  revalidate={() => setEnabled(true)}
                  showCollectionChip={!defaultCollectionOnly}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
