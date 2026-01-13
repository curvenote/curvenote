import { withAppSiteContext, createPreviewToken } from '@curvenote/scms-server';
import {
  useRevalidateOnInterval,
  PageFrame,
  EmptyMessage,
  getWorkflow,
  site as siteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
  type Workflow,
} from '@curvenote/scms-core';
import { useEffect, useState } from 'react';
import { dbGetInboxSubmissions } from './db.server.js';
import { SubmissionList } from '../../components/SubmissionList.js';
import { SiteTrackEvent } from '../../analytics/events.js';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import type { SiteDTO } from '@curvenote/common';
import type { sites, jobs } from '@curvenote/scms-server';

type BaseSubmission = Awaited<ReturnType<typeof sites.submissions.list>>['items'][0];
type BaseJob = Awaited<ReturnType<typeof jobs.list>>['items'][0];

type AugmentedSubmission = BaseSubmission & {
  workflow: Workflow;
  signature: string;
  job: BaseJob | undefined;
};

interface LoaderData {
  scopes: string[];
  site: SiteDTO;
  groups: Array<{
    status: string;
    items: AugmentedSubmission[];
  }>;
  jobs: Awaited<ReturnType<typeof dbGetInboxSubmissions>>['jobs'];
  defaultCollectionOnly: boolean;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const { groups, jobs } = await dbGetInboxSubmissions(ctx);

  // Calculate total submission count for metadata
  const totalSubmissions = groups.reduce((sum, group) => sum + group.items.length, 0);

  // Get user's role on this site
  const userSiteRole =
    ctx.user?.site_roles.find((sr) => sr.site_id === ctx.site.id)?.role || 'none';

  await ctx.trackEvent(SiteTrackEvent.SITE_VIEWED, {
    siteName: ctx.site.name,
    siteType: ctx.site.private ? 'private' : 'public',
    userRole: userSiteRole,
    submissionCount: totalSubmissions,
    pageType: 'inbox',
  });

  await ctx.analytics.flush();

  const augmentedGroups = await Promise.all(
    groups.map(async (g) => ({
      ...g,
      items: await Promise.all(
        g.items.map(async (s) => {
          const job = jobs.items?.find(
            (j) => (j.payload as any).submission_version_id === s.version_id,
          );
          const workflow = getWorkflow(ctx.$config, [], s.collection.workflow);
          return {
            ...s,
            workflow,
            signature: createPreviewToken(
              ctx.site.name,
              s.id,
              ctx.$config.api.previewIssuer,
              ctx.$config.api.previewSigningSecret,
            ),
            job,
          };
        }),
      ),
    })),
  );

  return {
    scopes: ctx.scopes,
    site: ctx.siteDTO,
    groups: augmentedGroups,
    jobs,
    defaultCollectionOnly: ctx.site.collections.length === 1 && ctx.site.collections[0].default,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Inbox', loaderData?.site?.title, branding.title) }];
};

export default function Inbox({ loaderData }: { loaderData: LoaderData }) {
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
      title="Inbox"
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
