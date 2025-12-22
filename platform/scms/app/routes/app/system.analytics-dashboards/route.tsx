import type { Route } from './+types/route';
import { withAppAdminContext, withValidFormData } from '@curvenote/scms-server';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle, ui } from '@curvenote/scms-core';
import { useActionData } from 'react-router';
import { useEffect } from 'react';
import {
  dbGetAnalyticsDashboards,
  dbCreateAnalyticsDashboard,
  dbUpdateAnalyticsDashboard,
  dbDeleteAnalyticsDashboard,
  dbGetSites,
} from './db.server';
import { AnalyticsDashboardsList } from './AnalyticsDashboardsList';
import { AnalyticsDashboardForm } from './AnalyticsDashboardForm';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { uuidv7 as uuid } from 'uuidv7';

// Zod schema for form validation
const AnalyticsDashboardSchema = zfd
  .formData({
    intent: z.enum(['create', 'update', 'delete']),
    id: zfd.text(z.string().optional()),
    title: zfd.text(z.string().optional()),
    description: zfd.text(z.string().optional()),
    type: z.enum(['PLATFORM', 'SITE']).optional(),
    url: zfd.text(z.string().optional()),
    site_id: zfd.text(z.string().optional()),
    enabled: zfd.text(z.string().transform((val) => val === 'true')).optional(),
  })
  .refine(
    (data) => {
      // For delete operations, only id is required
      if (data.intent === 'delete') {
        return !!data.id;
      }
      // For create and update operations, validate required fields
      if (data.intent === 'create' || data.intent === 'update') {
        return !!(data.title && data.type && data.url);
      }
      return true;
    },
    {
      message: 'Required fields are missing for the operation',
      path: ['intent'],
    },
  );

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppAdminContext(args, { redirectTo: '/app' });
  const [dashboards, sites] = await Promise.all([dbGetAnalyticsDashboards(), dbGetSites()]);

  return {
    scopes: ctx.scopes,
    dashboards,
    sites,
  };
}

export async function action(args: Route.ActionArgs) {
  await withAppAdminContext(args);
  const formData = await args.request.formData();

  return withValidFormData(AnalyticsDashboardSchema, formData, async (payload) => {
    switch (payload.intent) {
      case 'create': {
        if (!payload.title || !payload.type || !payload.url) {
          throw new Error('Title, type, and URL are required for create');
        }
        const dashboard = await dbCreateAnalyticsDashboard({
          id: uuid(),
          title: payload.title,
          description: payload.description || undefined,
          type: payload.type,
          url: payload.url,
          site_id: payload.site_id || undefined,
          enabled: !!payload.enabled,
        });
        return {
          success: true,
          message: 'Analytics dashboard created successfully',
          dashboard,
        };
      }
      case 'update': {
        if (!payload.id) {
          throw new Error('ID is required for update');
        }
        if (!payload.title || !payload.type || !payload.url) {
          throw new Error('Title, type, and URL are required for update');
        }
        const dashboard = await dbUpdateAnalyticsDashboard(payload.id, {
          title: payload.title,
          description: payload.description || undefined,
          type: payload.type,
          url: payload.url,
          site_id: payload.site_id || undefined,
          enabled: !!payload.enabled,
        });
        return {
          success: true,
          message: 'Analytics dashboard updated successfully',
          dashboard,
        };
      }
      case 'delete': {
        if (!payload.id) {
          throw new Error('ID is required for delete');
        }
        await dbDeleteAnalyticsDashboard(payload.id);
        return { success: true, message: 'Analytics dashboard deleted successfully' };
      }
      default: {
        throw new Error('Invalid intent');
      }
    }
  });
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    { title: joinPageTitle('Analytics Dashboards', 'System Administration', branding.title) },
  ];
};

export default function AnalyticsDashboardsAdmin({ loaderData }: Route.ComponentProps) {
  const { dashboards, sites } = loaderData;
  const actionData = useActionData<typeof action>();

  // Handle toast notifications
  useEffect(() => {
    if (!actionData) return;

    if ('success' in actionData && actionData.success && 'message' in actionData) {
      ui.toastSuccess(actionData.message);
    } else if ('error' in actionData && actionData.error) {
      ui.toastError(actionData.error.message);
    }
  }, [actionData]);

  return (
    <PageFrame title="Analytics Dashboards">
      <div className="space-y-6">
        {/* Create New Dashboard Form */}
        <ui.Card className="p-6 bg-card">
          <h2 className="mb-4 text-lg font-semibold">Create New Analytics Dashboard</h2>
          <AnalyticsDashboardForm sites={sites} />
        </ui.Card>

        <ui.Card className="p-6 bg-card">
          <h2 className="mb-4 text-lg font-semibold">Existing Analytics Dashboards</h2>
          <AnalyticsDashboardsList dashboards={dashboards} sites={sites} />
        </ui.Card>
      </div>
    </PageFrame>
  );
}
