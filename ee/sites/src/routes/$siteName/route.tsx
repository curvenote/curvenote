import { redirect, Outlet } from 'react-router';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import type { MenuContents } from '@curvenote/scms-core';
import {
  SecondaryNav,
  MainWrapper,
  site as siteScope,
  system,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { withAppSiteContext, hasScopeViaSystemRole, my } from '@curvenote/scms-server';
import { buildMenu } from './menu.server.js';
import type { SiteDTO } from '@curvenote/common';
import { extension } from '../../client.js';

interface LoaderData {
  scopes: string[];
  site: SiteDTO;
  hasMultipleSites: boolean;
  menu: MenuContents;
}

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData | Response> {
  const ctx = await withAppSiteContext(args, [siteScope.submissions.list], {
    redirectTo: '/app',
    redirect: true,
  });

  const pathname = new URL(args.request.url).pathname;
  if (pathname.endsWith(ctx.site.name)) {
    return redirect(`/app/sites/${ctx.site.name}/inbox`);
  }

  let hasMultipleSites = hasScopeViaSystemRole(ctx.user?.system_role, system.admin);
  if (!hasMultipleSites) {
    hasMultipleSites = (await my.siteCount(ctx)) > 1;
  }

  await my.siteCount(ctx);

  const menu = await buildMenu(ctx);

  return { scopes: ctx.scopes, site: ctx.siteDTO, hasMultipleSites, menu };
}

export const meta: MetaFunction = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle((loaderData as LoaderData).site.title, branding.title) }];
};

export default function ({ loaderData }: { loaderData: LoaderData }) {
  const { menu, site } = loaderData;

  return (
    <>
      <SecondaryNav
        branding={{
          logo: site.logo,
          logo_dark: site.logo_dark,
          url: site.links.html,
        }}
        title={site.title}
        contents={menu as MenuContents}
        extensions={[extension]}
      />
      <MainWrapper hasSecondaryNav>
        <Outlet />
      </MainWrapper>
    </>
  );
}
