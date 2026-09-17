import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
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
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
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
  /** null when api.crossref is missing from the deployment's config. */
  curvenotePrefix: string | null;
  roleBoundBy?: { name: string; date: string };
}

/** Site admins only: members hold site:doi:read, which does not open this screen. */
const REQUIRED_SCOPES = [scopes.site.doi.configure];

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, REQUIRED_SCOPES, {
    redirectTo: '/app',
    redirect: true,
  });
  const prisma = await getPrismaClient();
  const [siteWithAppData, row] = await Promise.all([
    getSiteWithAppData(ctx.site.name),
    dbGetDoiConfig(prisma, ctx.site.id),
  ]);
  // The loader never calls Crossref: it only needs Curvenote's prefix, which is config.
  let curvenotePrefix: string | null = null;
  try {
    curvenotePrefix = crossrefCredentialsFromConfig(ctx.$config).prefix;
  } catch (error: any) {
    console.error('[doi]', error?.message);
  }
  const hasBoundRole = row?.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX && Boolean(row.role);
  return {
    site: ctx.siteDTO,
    config: row ? toDTO(row) : null,
    doiCustomPrefixEnabled: siteWithAppData?.data?.doiCustomPrefixEnabled ?? false,
    isSystemAdmin: userHasScope(ctx.user, scopes.system.admin),
    curvenotePrefix,
    roleBoundBy: hasBoundRole ? await dbGetRoleBoundBy(prisma, ctx.site.id) : undefined,
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
  const { site, config, doiCustomPrefixEnabled, isSystemAdmin, curvenotePrefix, roleBoundBy } =
    loaderData;
  return (
    <PageFrame title="DOI Registration" subtitle="Configure how this Site registers DOIs.">
      <div className="flex flex-col max-w-4xl space-y-5">
        {!curvenotePrefix && (
          <ui.SimpleAlert
            type="error"
            message="DOI registration is not configured on this deployment. Ask a Curvenote engineer to set api.crossref."
          />
        )}
        {curvenotePrefix && !config && (
          <DoiSetup siteTitle={site.title} customPrefixEnabled={doiCustomPrefixEnabled} />
        )}
        {curvenotePrefix && config && (
          <>
            <DoiStatusCard config={config} />
            <DoiAccountCard
              config={config}
              siteTitle={site.title}
              customPrefixEnabled={doiCustomPrefixEnabled}
            />
            {isSystemAdmin && config.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX && (
              <DoiRoleAdminCard config={config} roleBoundBy={roleBoundBy} />
            )}
            {isSystemAdmin && <DoiAdvancedActionsCard config={config} siteTitle={site.title} />}
          </>
        )}
      </div>
    </PageFrame>
  );
}
