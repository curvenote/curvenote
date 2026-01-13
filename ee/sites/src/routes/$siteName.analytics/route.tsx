import { withAppSiteContext } from '@curvenote/scms-server';
import { PageFrame, ui, getBrandingFromMetaMatches, joinPageTitle } from '@curvenote/scms-core';
import { ExternalLink } from 'lucide-react';
import { dbGetSiteAnalyticsDashboards, dbGetSiteSubmissionStats } from './db.server.js';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import type { SiteDTO } from '@curvenote/common';
import type { AnalyticsDashboard } from '@prisma/client';

interface LoaderData {
  site: SiteDTO;
  analyticsDashboards: AnalyticsDashboard[];
  submissionStats: Awaited<ReturnType<typeof dbGetSiteSubmissionStats>>;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [], { redirectTo: '/app', redirect: true });

  const [analyticsDashboards, submissionStats] = await Promise.all([
    dbGetSiteAnalyticsDashboards(ctx.site.id),
    dbGetSiteSubmissionStats(ctx.site.id),
  ]);

  return {
    site: ctx.siteDTO,
    analyticsDashboards,
    submissionStats,
  };
}

export const meta: MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Analytics', branding.title) }];
};

export default function SiteAnalytics({ loaderData }: { loaderData: LoaderData }) {
  const { site, analyticsDashboards, submissionStats } = loaderData;

  return (
    <PageFrame title="Analytics" subtitle={`Analytics for ${site.title}`}>
      <div className="space-y-6">
        {/* Site Statistics */}
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="mb-4 text-lg font-semibold">Site Statistics</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {submissionStats.totalSubmissions.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Submissions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {Object.keys(submissionStats.byKind).length}
              </div>
              <div className="text-sm text-muted-foreground">Submission Kinds</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {Object.keys(submissionStats.byCollection).length}
              </div>
              <div className="text-sm text-muted-foreground">Collections</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {(submissionStats.byStatus.PUBLISHED || 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Published</div>
            </div>
          </div>
        </div>

        {/* Detailed Statistics */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Submissions by Status */}
          <ui.Card>
            <ui.CardHeader>
              <ui.CardTitle className="text-lg">Submissions by Status</ui.CardTitle>
            </ui.CardHeader>
            <ui.CardContent>
              <div className="space-y-2">
                {Object.entries(submissionStats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{status.toLowerCase()}</span>
                    <span className="font-medium">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </ui.CardContent>
          </ui.Card>

          {/* Submissions by Kind */}
          <ui.Card>
            <ui.CardHeader>
              <ui.CardTitle className="text-lg">Submissions by Kind</ui.CardTitle>
            </ui.CardHeader>
            <ui.CardContent>
              <div className="space-y-2">
                {Object.entries(submissionStats.byKind).map(([kind, count]) => (
                  <div key={kind} className="flex items-center justify-between">
                    <span className="text-sm">{kind}</span>
                    <span className="font-medium">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </ui.CardContent>
          </ui.Card>

          {/* Submissions by Collection */}
          <ui.Card>
            <ui.CardHeader>
              <ui.CardTitle className="text-lg">Submissions by Collection</ui.CardTitle>
            </ui.CardHeader>
            <ui.CardContent>
              <div className="space-y-2">
                {Object.entries(submissionStats.byCollection).map(([collection, count]) => (
                  <div key={collection} className="flex items-center justify-between">
                    <span className="text-sm">{collection}</span>
                    <span className="font-medium">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </ui.CardContent>
          </ui.Card>
        </div>

        {/* Analytics Dashboards */}
        {analyticsDashboards.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Analytics Dashboards</h2>
            <div className="space-y-6">
              {analyticsDashboards.map((dashboard) => (
                <ui.Card key={dashboard.id}>
                  <ui.CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <ui.CardTitle className="text-lg">{dashboard.title}</ui.CardTitle>
                        {dashboard.description && (
                          <p className="text-sm text-muted-foreground">{dashboard.description}</p>
                        )}
                      </div>
                      <a
                        href={dashboard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors text-muted-foreground hover:text-primary"
                        title="Open dashboard in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </ui.CardHeader>
                  <ui.CardContent>
                    <div className="w-full aspect-video">
                      <iframe
                        src={dashboard.url}
                        className="w-full h-full border rounded-md"
                        title={dashboard.title}
                      />
                    </div>
                  </ui.CardContent>
                </ui.Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="mb-4 text-lg font-semibold">Analytics Dashboards</h2>
            <p className="text-muted-foreground">
              No analytics dashboards configured for this site yet. Contact your system
              administrator to set up site analytics.
            </p>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
