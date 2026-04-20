import type { Route } from './+types/route';
import { redirect, Outlet } from 'react-router';
import { withAppScopedContext } from '@curvenote/scms-server';
import {
  SecondaryNav,
  MainWrapper,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
} from '@curvenote/scms-core';
import { buildMenu } from './menu';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.settings.read]);
  console.log(
    'scopes len',
    ctx.scopes.length,
    'user roles',
    ctx.user?.roles?.length,
    ctx.user?.site_roles?.length,
  );
  const pathname = new URL(args.request.url).pathname;
  if (pathname === '/app/settings') {
    throw redirect('/app/settings/account');
  }

  const menu = buildMenu(`/app/settings`, ctx.scopes);
  return { menu };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Settings', branding.title) }];
};

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { menu } = loaderData;
  return (
    <>
      <SecondaryNav
        contents={menu}
        title="Settings"
        subtitle="Manage your account"
        extensions={extensions}
      />
      <MainWrapper hasSecondaryNav>
        <Outlet />
      </MainWrapper>
    </>
  );
}
