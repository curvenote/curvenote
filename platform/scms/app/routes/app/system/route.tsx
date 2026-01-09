import type { Route } from './+types/route';
import { Outlet, redirect } from 'react-router';
import { MainWrapper, SecondaryNav } from '@curvenote/scms-core';
import { withAppAdminContext } from '@curvenote/scms-server';
import { buildMenu } from './menu';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppAdminContext(args, { redirectTo: '/app' });
  const pathname = new URL(ctx.request.url).pathname;
  if (pathname === '/app/system') {
    return redirect('/app/system/users');
  }
  const menu = buildMenu('/app/system', ctx.scopes);
  return { menu };
}

export default function Guard({ loaderData }: Route.ComponentProps) {
  const { menu } = loaderData;

  return (
    <>
      <SecondaryNav
        contents={menu}
        title="System Settings"
        subtitle="Systems administrators only"
        extensions={extensions}
      />
      <MainWrapper hasSecondaryNav>
        <Outlet />
      </MainWrapper>
    </>
  );
}
