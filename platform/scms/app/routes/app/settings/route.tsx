import type { Route } from './+types/route';
import { redirect, Outlet } from 'react-router';
import { withAppContext } from '@curvenote/scms-server';
import {
  SecondaryNav,
  MainWrapper,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { buildMenu } from './menu';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
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
