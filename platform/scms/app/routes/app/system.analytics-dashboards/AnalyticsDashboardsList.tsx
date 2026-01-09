import { useState } from 'react';
import { Form } from 'react-router';
import { ui } from '@curvenote/scms-core';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import type { AnalyticsDashboardDTO } from './db.server';
import { AnalyticsDashboardForm } from './AnalyticsDashboardForm';

interface AnalyticsDashboardsListProps {
  dashboards: AnalyticsDashboardDTO[];
  sites: Array<{
    id: string;
    name: string;
    title: string;
  }>;
}

export function AnalyticsDashboardsList({ dashboards, sites }: AnalyticsDashboardsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'PLATFORM':
        return 'default';
      case 'SITE':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getSiteTitle = (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    return site ? `${site.title} (${site.name})` : 'Unknown Site';
  };

  if (dashboards.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">No analytics dashboards configured yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first dashboard using the form above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dashboards.map((dashboard) => (
        <ui.Card key={dashboard.id}>
          <ui.CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <ui.CardTitle className="flex items-center gap-2 text-lg">
                  {dashboard.title}
                  <ui.Badge variant={getTypeBadgeVariant(dashboard.type)}>
                    {dashboard.type}
                  </ui.Badge>
                  {!dashboard.enabled && <ui.Badge variant="destructive">Disabled</ui.Badge>}
                </ui.CardTitle>
                {dashboard.description && (
                  <p className="text-sm text-muted-foreground">{dashboard.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ui.Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(editingId === dashboard.id ? null : dashboard.id)}
                >
                  <Pencil className="w-4 h-4" />
                </ui.Button>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={dashboard.id} />
                  <ui.Button type="submit" variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </ui.Button>
                </Form>
                <ui.Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(dashboard.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </ui.Button>
              </div>
            </div>
          </ui.CardHeader>
          <ui.CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">URL:</span>
                <a
                  href={dashboard.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-md text-sm text-blue-600 truncate hover:underline"
                >
                  {dashboard.url}
                </a>
              </div>

              {dashboard.type === 'SITE' && dashboard.site && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Site:</span>
                  <span className="text-sm text-muted-foreground">
                    {getSiteTitle(dashboard.site_id!)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Created: {new Date(dashboard.date_created).toLocaleDateString()}</span>
                <span>Modified: {new Date(dashboard.date_modified).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Edit Form (Inline) */}
            {editingId === dashboard.id && (
              <div className="pt-4 mt-4 border-t">
                <AnalyticsDashboardForm
                  sites={sites}
                  dashboard={dashboard}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            )}
          </ui.CardContent>
        </ui.Card>
      ))}
    </div>
  );
}
