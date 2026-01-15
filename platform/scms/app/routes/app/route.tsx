import type { Route } from './+types/route';
import { redirect, Outlet } from 'react-router';
import { withAppContext, my } from '@curvenote/scms-server';
import {
  GlobalErrorBoundary,
  LoadingBar,
  Mobile,
  MobileControls,
  PrimaryNav,
  cn,
  getBrandingFromMetaMatches,
} from '@curvenote/scms-core';
import { extensions as serverExtensions } from '../../extensions/server';
import { extensions as clientExtensions } from '../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  const hasSitesExtension = serverExtensions.some((ext) => ext.id === 'sites');

  const sites = hasSitesExtension ? await my.sites(ctx) : { items: [] };

  const pathname = new URL(args.request.url).pathname;
  if (pathname === '/app') {
    // Use configured default route or fallback to first navigation item
    const navConfig = ctx.$config.app?.navigation;
    const defaultRoute =
      (navConfig && 'defaultRoute' in navConfig ? navConfig.defaultRoute : undefined) || 'settings';
    throw redirect('/app/' + defaultRoute);
  }

  return { scopes: ctx.scopes, sites };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ key: 'title', title: branding.title }];
};

export default function App() {
  return (
    <div data-name="app-route" className="flex relative w-full min-h-screen">
      <Mobile>
        <MobileControls />
        <PrimaryNav extensions={clientExtensions} />
        <div className="flex relative flex-col flex-1 w-full">
          <div className="fixed z-50 top-0 h-[3px] w-full">
            <LoadingBar />
          </div>
          <div
            data-name="app-layout"
            className={cn(
              'flex min-h-screen mx-auto w-[calc(100%-20px)] xl:ml-[110px] md:w-[calc(100%-40px)] lg:w-[calc(100%-110px)]',
            )}
          >
            <Outlet />
          </div>
        </div>
      </Mobile>
    </div>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}
