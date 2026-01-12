import type { Route } from './+types/route';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle, ui } from '@curvenote/scms-core';
import { withAppPlatformAdminContext } from '@curvenote/scms-server';
import { dbCountUsers } from '../platform.users/db.server';
import {
  dbCountSubmissionsByStatus,
  dbCountSites,
  dbGetPlatformAnalyticsDashboards,
} from './db.server';
import { ExternalLink } from 'lucide-react';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const [totalUsers, totalSites, submissionStats, analyticsDashboards] = await Promise.all([
    dbCountUsers(),
    dbCountSites(),
    dbCountSubmissionsByStatus(),
    dbGetPlatformAnalyticsDashboards(),
  ]);

  return {
    scopes: ctx.scopes,
    totalUsers,
    totalSites,
    submissionStats,
    analyticsDashboards,
  };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Analytics', 'Platform Administration', branding.title) }];
};

export default function PlatformAnalytics({ loaderData }: Route.ComponentProps) {
  const { totalUsers, totalSites, submissionStats, analyticsDashboards } = loaderData;

  return (
    <PageFrame title="Analytics">
      <div className="space-y-6">
        {/* Platform Statistics */}
        <ui.Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Platform Statistics</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{totalUsers.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{totalSites.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Sites</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {submissionStats.published.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Published Submissions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {submissionStats.draft.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Draft Submissions</div>
            </div>
          </div>
        </ui.Card>

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
                    <div className="w-full overflow-auto resize-y h-160">
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
              No analytics dashboards configured yet. Contact your system administrator to set up
              platform analytics.
            </p>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
