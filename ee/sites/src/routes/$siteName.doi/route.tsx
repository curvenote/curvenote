import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { redirect } from 'react-router';
import type { SiteDTO } from '@curvenote/common';
import {
  PageFrame,
  SITE_DOI_CONFIG_MODE,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
  ui,
} from '@curvenote/scms-core';
import { getPrismaClient, userHasScope, withAppSiteContext } from '@curvenote/scms-server';
import { crossrefCredentialsFromConfig } from '../../backend/crossref/client.server.js';
import { getSiteWithAppData } from '../../backend/db.server.js';
import { dbGetDoiConfig, dbGetRoleBoundBy, toDTO } from '../../backend/doi/db.server.js';
import { dbListKindMappings } from '../../backend/doi/kinds.db.server.js';
import type { EligibleKindDTO, SiteDoiConfigDTO } from '../../backend/doi/types.js';
import { runDoiIntent } from './actionHelper.server.js';
import { DoiStatusCard } from './DoiStatusCard.js';
import { DoiAccountCard } from './DoiAccountCard.js';
import { DoiSetup } from './DoiSetup.js';
import { DoiRoleAdminCard } from './DoiRoleAdminCard.js';
import { DoiAdvancedActionsCard } from './DoiAdvancedActionsCard.js';

export interface LoaderData {
  site: SiteDTO;
  config: SiteDoiConfigDTO | null;
  doiCustomPrefixEnabled: boolean;
  isSystemAdmin: boolean;
  /**
   * The public half of api.crossref (never the password): Curvenote's prefix and the depositor
   * a customer grants access to. null when api.crossref is missing from the deployment's config.
   */
  crossref: { prefix: string; depositorEmail: string } | null;
  roleBoundBy?: { name: string; date: string };
  /** Empty until the site has a DOI setup: the card only shows then. */
  kinds: EligibleKindDTO[];
}

/** Site admins only: members hold site:doi:read, which does not open this screen. */
const REQUIRED_SCOPES = [scopes.site.doi.configure];

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, REQUIRED_SCOPES, {
    redirectTo: '/app',
    redirect: true,
  });
  // withAppSiteContext only checks site scopes; app:sites:doi:feature is the per-user preview
  // flag (granted through a Role, e.g. doi-preview) that actually gates this screen. System
  // admins pass automatically because userHasScope short-circuits on system:admin.
  if (!userHasScope(ctx.user, scopes.app.sites.doi.feature)) {
    throw redirect('/app');
  }
  const prisma = await getPrismaClient();
  const [siteWithAppData, row] = await Promise.all([
    getSiteWithAppData(ctx.site.name),
    dbGetDoiConfig(prisma, ctx.site.id),
  ]);
  // The loader never calls Crossref: it only needs values from config.
  let crossref: LoaderData['crossref'] = null;
  try {
    const { prefix, depositorEmail } = crossrefCredentialsFromConfig(ctx.$config);
    crossref = { prefix, depositorEmail };
  } catch (error: any) {
    console.error('[doi]', error?.message);
  }
  const hasBoundRole = row?.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX && Boolean(row.role);
  return {
    site: ctx.siteDTO,
    config: row ? toDTO(row) : null,
    doiCustomPrefixEnabled: siteWithAppData?.data?.doiCustomPrefixEnabled ?? false,
    isSystemAdmin: userHasScope(ctx.user, scopes.system.admin),
    crossref,
    roleBoundBy: hasBoundRole ? await dbGetRoleBoundBy(prisma, ctx.site.id) : undefined,
    kinds: row ? await dbListKindMappings(prisma, ctx.site.id) : [],
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, REQUIRED_SCOPES);
  return runDoiIntent(ctx, await ctx.request.formData());
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('DOI Registration', loaderData?.site?.title, branding.title) }];
};

export default function DoiRegistration({ loaderData }: { loaderData: LoaderData }) {
  const { site, config, doiCustomPrefixEnabled, isSystemAdmin, crossref, roleBoundBy } = loaderData;
  return (
    <PageFrame title="DOI Registration" subtitle="Configure how this Site registers DOIs.">
      <div className="flex flex-col max-w-4xl space-y-5">
        {!crossref && (
          <ui.SimpleAlert
            type="error"
            message="DOI registration is not configured on this deployment. Ask a Curvenote engineer to set api.crossref."
          />
        )}
        {crossref && !config && (
          <DoiSetup siteTitle={site.title} customPrefixEnabled={doiCustomPrefixEnabled} />
        )}
        {crossref && config && (
          <>
            <DoiStatusCard config={config} />
            <DoiAccountCard
              config={config}
              siteTitle={site.title}
              customPrefixEnabled={doiCustomPrefixEnabled}
              depositorEmail={crossref.depositorEmail}
              isSystemAdmin={isSystemAdmin}
              roleBoundBy={roleBoundBy}
            />
            {isSystemAdmin && config.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX && (
              <DoiRoleAdminCard config={config} />
            )}
            {isSystemAdmin && <DoiAdvancedActionsCard config={config} siteTitle={site.title} />}
          </>
        )}
      </div>
    </PageFrame>
  );
}
