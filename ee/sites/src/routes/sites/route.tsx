import { Outlet, useLocation, data } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useState } from 'react';
import {
  withAppContext,
  checkSiteExists,
  userHasScope,
  validateFormData,
  withAppScopedContext,
} from '@curvenote/scms-server';
import SiteCard from './SiteCard.js';
import RequestSiteCTA from './RequestSiteCTA.js';
import type { FeaturedSitesData } from './RequestSiteCTA.js';
import PendingSiteCard from './PendingSiteCard.js';
import { MainWrapper, PageFrame, scopes, clientCheckSiteScopes } from '@curvenote/scms-core';
import type { ui } from '@curvenote/scms-core';
import { actionCreateSite, actionRequestSite } from './actionHelpers.server.js';
import { dbListSiteCards } from './db.server.js';
import type { SiteCardListing } from './types.js';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

interface LoaderData {
  video?: ui.VideoData;
  featured?: FeaturedSitesData;
  canCreateSite: boolean;
  scopes: string[];
  sites: SiteCardListing;
}

export const loader = async (args: LoaderFunctionArgs): Promise<LoaderData> => {
  const ctx = await withAppScopedContext(args, [scopes.app.sites.feature], { redirect: true });
  const { video, featured } = ctx.$config.app.extensions?.sites ?? {};
  const sites = await dbListSiteCards(ctx);

  return {
    video,
    featured,
    canCreateSite: userHasScope(ctx.user, scopes.site.create),
    scopes: ctx.scopes,
    sites,
  };
};

const IntentSchema = zfd.formData({
  intent: z.enum(['request-site', 'check-site-name', 'create-site']),
});

const CheckSiteNameSchema = zfd.formData({
  intent: z.literal('check-site-name'),
  name: zfd.text(
    z
      .string()
      .min(3, 'URL name must be at least 3 characters')
      .max(30, 'URL name must be at most 30 characters')
      .regex(/^[a-z0-9-]+$/, 'URL name must contain only lowercase letters, numbers, and hyphens'),
  ),
});

export const action = async (args: ActionFunctionArgs) => {
  const ctx = await withAppContext(args);

  const formData = await args.request.formData();

  let intent: 'request-site' | 'check-site-name' | 'create-site';
  try {
    const validated = validateFormData(IntentSchema, formData);
    intent = validated.intent;
  } catch (error: any) {
    return data({ error: error.message ?? 'Invalid intent' }, { status: 400 });
  }

  if (intent === 'request-site') {
    if (!userHasScope(ctx.user, scopes.app.sites.request)) {
      return data({ error: 'You are not authorized to request a site' }, { status: 403 });
    }
    return actionRequestSite(ctx, formData);
  } else if (intent === 'check-site-name') {
    if (!userHasScope(ctx.user, scopes.site.create)) {
      return data({ error: 'You are not authorized to check site name' }, { status: 403 });
    }
    try {
      const payload = validateFormData(CheckSiteNameSchema, formData);
      const exists = await checkSiteExists(payload.name);
      return { available: !exists };
    } catch (error: any) {
      return data({ error: error.message ?? 'Invalid form data' }, { status: 400 });
    }
  } else if (intent === 'create-site') {
    if (!userHasScope(ctx.user, scopes.site.create)) {
      return data({ error: 'You are not authorized to create a site' }, { status: 403 });
    }
    return actionCreateSite(ctx, formData);
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export default function Sites({ loaderData }: { loaderData: LoaderData }) {
  const location = useLocation();
  const { video, featured, canCreateSite, scopes: userScopes, sites } = loaderData;
  const [showPendingCard, setShowPendingCard] = useState(false);

  const canRequestSite = clientCheckSiteScopes(userScopes, [scopes.app.sites.request], '');

  if (location.pathname !== '/app/sites') {
    return <Outlet />;
  }

  const handleCreateSite = () => {
    setShowPendingCard(true);
  };

  const handleCancelPendingCard = () => {
    setShowPendingCard(false);
  };

  return (
    <>
      <MainWrapper>
        <PageFrame
          title="My Sites"
          subtitle="Manage your sites and publishing venues"
          hasSecondaryNav={false}
        >
          <div className="mt-0 space-y-6">
            {canRequestSite && (
              <RequestSiteCTA
                hasExistingSites={sites.items.length > 0}
                video={video}
                featured={featured}
                canCreateSite={canCreateSite}
                onCreateSite={handleCreateSite}
                showPendingCard={showPendingCard}
              />
            )}

            {(sites.items.length > 0 || showPendingCard) && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {showPendingCard && <PendingSiteCard onCancel={handleCancelPendingCard} />}
                {sites.items.map((site) => (
                  <SiteCard key={site.id} site={site} />
                ))}
              </div>
            )}
          </div>
        </PageFrame>
      </MainWrapper>
    </>
  );
}
