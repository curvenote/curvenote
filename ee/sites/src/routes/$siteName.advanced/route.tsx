import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import { withAppSiteContext, validateFormData } from '@curvenote/scms-server';
import type { JsonObject } from '@prisma/client/runtime/library';
import {
  SystemAdminBadge,
  PageFrame,
  primitives,
  ui,
  site as siteScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
  error404,
} from '@curvenote/scms-core';
import {
  actionSaveSiteRestriction,
  actionUpdateSiteByJson,
  actionUpdateSiteSettings,
} from './actionHelper.server.js';
import { SubmissionSettingsForm } from './SubmissionSettingsForm.js';
import { SiteMetadataForm } from './SiteMetadataForm.js';
import { SiteSettingsForm } from './SiteSettingsForm.js';
import type { SiteDTO } from '@curvenote/common';
import { getSiteWithAppData } from '../../backend/db.server.js';
import type { SiteWithAppData } from '../../backend/db.server.js';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

interface LoaderData {
  site: SiteDTO;
  siteWithAppData: SiteWithAppData;
  metadata: JsonObject;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.update], {
    redirectTo: '/app',
    redirect: true,
  });

  // Get site with app-specific data (not exposed via public API)
  const siteWithAppData = await getSiteWithAppData(ctx.site.name);
  if (!siteWithAppData) throw error404('Site not found');

  const metadata = typeof ctx.site.metadata === 'object' ? ctx.site.metadata : {};

  // Filter out fields that are duplicated in the site table
  const {
    id, // eslint-disable-line @typescript-eslint/no-unused-vars
    name, // eslint-disable-line @typescript-eslint/no-unused-vars
    title, // eslint-disable-line @typescript-eslint/no-unused-vars
    description, // eslint-disable-line @typescript-eslint/no-unused-vars
    private: privateField, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...filteredMetadata
  } = metadata as JsonObject;

  return { site: ctx.siteDTO, siteWithAppData, metadata: filteredMetadata };
}

const FormActionSchema = zfd.formData({
  formAction: z.enum(['update-site', 'restrict', 'update-site-settings']),
});

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.update]);

  const formData = await ctx.request.formData();

  // Validate formAction
  let payload: { formAction: string };
  try {
    payload = validateFormData(FormActionSchema, formData);
  } catch (error: any) {
    return data({ error: error.message ?? 'Invalid form action' }, { status: 400 });
  }

  const { formAction } = payload;

  if (formAction === 'update-site') {
    return actionUpdateSiteByJson(ctx, formData);
  } else if (formAction === 'restrict') {
    return actionSaveSiteRestriction(ctx, formData);
  } else if (formAction === 'update-site-settings') {
    return actionUpdateSiteSettings(ctx, formData);
  }

  return data({ error: 'Invalid form action' }, { status: 400 });
}

export const meta: MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Site Settings', branding.title) }];
};

export default function Settings({ loaderData }: { loaderData: LoaderData }) {
  const { site, siteWithAppData, metadata } = loaderData;

  return (
    <PageFrame title="Site Settings" subtitle={`Manage the settings for ${site.title}`}>
      <div className="flex flex-col space-y-5">
        <SystemAdminBadge />
        <primitives.Card lift className="max-w-4xl px-6 py-4 space-y-4">
          <h2>Site Information</h2>
          <p className="text-sm font-light">These fields cannot be changed.</p>
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium">Site ID</label>
              <ui.Input className="max-w-sm font-mono" disabled value={site.id} />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Site Name</label>
              <ui.Input className="max-w-sm" disabled value={site.name} />
            </div>
          </div>
        </primitives.Card>
        <SiteSettingsForm site={site} siteWithAppData={siteWithAppData} />
        <SubmissionSettingsForm site={site} />
        <SiteMetadataForm site={site} metadata={metadata} />
      </div>
    </PageFrame>
  );
}
