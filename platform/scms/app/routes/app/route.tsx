import type { Route } from './+types/route';
import { redirect, Outlet } from 'react-router';
import { withAppContext, my, resolveAccessibleDefaultRoute } from '@curvenote/scms-server';
import {
  GlobalErrorBoundary,
  LoadingBar,
  MainWrapper,
  Mobile,
  MobileControls,
  PageFrame,
  PrimaryNav,
  cn,
  getBrandingFromMetaMatches,
  useMobile,
} from '@curvenote/scms-core';
import { extensions as serverExtensions } from '../../extensions/server';
import { extensions as clientExtensions } from '../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  const hasSitesExtension = serverExtensions.some((ext) => ext.id === 'sites');

  const sites = hasSitesExtension ? await my.sites(ctx) : { items: [] };

  const pathname = new URL(args.request.url).pathname;
  if (pathname === '/app') {
    // Pick the first navigation item the user can access, preferring the
    // configured defaultRoute. This also catches the case where a gated child
    // route (e.g. /app/dashboard) bounced the user back to /app because they
    // lack the required scopes - without this we would redirect-loop.
    const navConfig = ctx.$config.app?.navigation;
    const target = resolveAccessibleDefaultRoute(ctx, navConfig);
    if (target) throw redirect('/app/' + target);
    return { scopes: ctx.scopes, sites, noAccessibleRoute: true };
  }

  return { scopes: ctx.scopes, sites, noAccessibleRoute: false };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ key: 'title', title: branding.title }];
};

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <div data-name="app-route" className="flex relative w-full min-h-screen">
      <Mobile>
        <AppShell noAccessibleRoute={loaderData?.noAccessibleRoute ?? false} />
      </Mobile>
    </div>
  );
}

function AppShell({ noAccessibleRoute }: { noAccessibleRoute: boolean }) {
  const { open, setMobileOpen } = useMobile();

  return (
    <>
      <MobileControls />
      <PrimaryNav extensions={clientExtensions} />
      <div className="flex relative flex-col flex-1 w-full">
        <div className="fixed top-0 z-50 w-full">
          <LoadingBar />
        </div>
        <div
          data-name="app-layout"
          onPointerDown={() => {
            if (!open) return;
            if (window.matchMedia('(min-width: 1280px)').matches) return;
            setMobileOpen(false);
          }}
          className={cn(
            'flex min-h-screen mx-auto w-[calc(100%-20px)] xl:ml-[110px] md:w-[calc(100%-40px)] lg:w-[calc(100%-110px)]',
          )}
        >
          {noAccessibleRoute ? <NoAccessibleRoute /> : <Outlet />}
        </div>
      </div>
    </>
  );
}

function NoAccessibleRoute() {
  return (
    <MainWrapper>
      <PageFrame hasSecondaryNav={false}>
        <div className="py-16 mx-auto max-w-xl text-center">
          <h1 className="mb-4 text-3xl font-light text-blue-900 dark:text-gray-100">
            No sections available
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your account doesn't have permission to view any sections of this app yet. If you
            believe this is a mistake, please contact your administrator.
          </p>
        </div>
      </PageFrame>
    </MainWrapper>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}
