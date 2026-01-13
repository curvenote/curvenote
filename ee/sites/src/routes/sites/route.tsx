import { Outlet, useLocation, data } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs, useMatches } from 'react-router';
import { useState } from 'react';
import {
  withAppContext,
  checkSiteExists,
  userHasScope,
  validateFormData,
} from '@curvenote/scms-server';
import SiteCard from './SiteCard.js';
import RequestSiteCTA from './RequestSiteCTA.js';
import PendingSiteCard from './PendingSiteCard.js';
import { MainWrapper, PageFrame, scopes } from '@curvenote/scms-core';
import type { UserSitesDTO } from '@curvenote/common';
import type { ui } from '@curvenote/scms-core';
import { actionCreateSite, actionRequestSite } from './actionHelpers.server.js';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

interface LoaderData {
  video?: ui.VideoData;
  canCreateSite: boolean;
}
export const loader = async (args: LoaderFunctionArgs): Promise<LoaderData> => {
  const ctx = await withAppContext(args);
  const { video } = ctx.$config.app.extensions?.sites ?? {};
  return {
    video,
    canCreateSite: userHasScope(ctx.user, scopes.site.create),
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

  // Validate intent
  let intent: 'request-site' | 'check-site-name' | 'create-site';
  try {
    const validated = validateFormData(IntentSchema, formData);
    intent = validated.intent;
  } catch (error: any) {
    return data({ error: error.message ?? 'Invalid intent' }, { status: 400 });
  }

  if (intent === 'request-site') {
    return actionRequestSite(ctx, formData);
  } else if (intent === 'check-site-name') {
    try {
      const payload = validateFormData(CheckSiteNameSchema, formData);
      const exists = await checkSiteExists(payload.name);
      return { available: !exists };
    } catch (error: any) {
      return data({ error: error.message ?? 'Invalid form data' }, { status: 400 });
    }
  } else if (intent === 'create-site' && userHasScope(ctx.user, scopes.site.create)) {
    return actionCreateSite(ctx, formData);
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export default function Sites({
  matches,
  loaderData,
}: {
  matches: ReturnType<typeof useMatches>;
  loaderData: LoaderData;
}) {
  const location = useLocation();
  const appRoute = matches.find((m) => m && m.pathname === '/app');
  const { video, canCreateSite } = loaderData;
  const [showPendingCard, setShowPendingCard] = useState(false);

  const { sites } = appRoute?.loaderData as {
    scopes: string[];
    sites: UserSitesDTO;
  };

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
          <div className="mt-5 space-y-6">
            <RequestSiteCTA
              hasExistingSites={sites.items.length > 0}
              video={video}
              canCreateSite={canCreateSite}
              onCreateSite={handleCreateSite}
              showPendingCard={showPendingCard}
            />

            {(sites.items.length > 0 || showPendingCard) && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {showPendingCard && <PendingSiteCard onCancel={handleCancelPendingCard} />}
                {sites.items.map((s: any) => (
                  <SiteCard key={s.id} site={s} />
                ))}
              </div>
            )}
          </div>
        </PageFrame>
      </MainWrapper>
    </>
  );
}
