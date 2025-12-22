import type { Route } from './+types/route';
import { Outlet, redirect } from 'react-router';
import {
  MainWrapper,
  SecondaryNav,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { withAppPlatformAdminContext } from '@curvenote/scms-server';
import { buildMenu } from './menu';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const pathname = new URL(ctx.request.url).pathname;
  if (pathname === '/app/platform') {
    throw redirect('/app/platform/users');
  }
  const menu = buildMenu('/app/platform', ctx.scopes);
  return { menu };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Platform Administration', branding.title) }];
};

export default function PlatformLayout({ loaderData }: Route.ComponentProps) {
  const { menu } = loaderData;

  return (
    <>
      <SecondaryNav
        contents={menu}
        title="Platform"
        subtitle="Manage platform-wide data and configuration"
        extensions={extensions}
      />
      <MainWrapper hasSecondaryNav>
        <Outlet />
      </MainWrapper>
    </>
  );
}
