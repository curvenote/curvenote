import type { Route } from './+types/route';
import { redirect, Outlet } from 'react-router';
import { withAppScopedContext } from '@curvenote/scms-server';
import {
  PageFrame,
  SecondaryNav,
  MainWrapper,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
} from '@curvenote/scms-core';
import { buildMenu } from './menu';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.settings.read], { redirect: true });
  const menu = buildMenu(`/app/settings`, ctx.scopes);
  const pathname = new URL(args.request.url).pathname;
  if (pathname === '/app/settings') {
    // Redirect to the first accessible settings sub-page based on the user's
    // scopes. Previously this unconditionally redirected to /app/settings/account,
    // which caused an infinite redirect loop for users who have
    // `app:settings:read` (so settings appears in the primary nav) but lack
    // `app:settings:account:read`: the account loader would redirect to /app,
    // which then redirects back to /app/settings via the default-route resolver.
    const firstAccessible = menu[0]?.menus[0]?.url;
    if (firstAccessible) {
      throw redirect(firstAccessible);
    }
    // Fall through with an empty menu; the component renders an inline
    // placeholder. Deliberately do NOT redirect to /app here - that route can
    // redirect back to /app/settings and re-create the loop.
  }

  return { menu };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Settings', branding.title) }];
};

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { menu } = loaderData;
  const hasAccessibleSection = (menu[0]?.menus.length ?? 0) > 0;
  return (
    <>
      <SecondaryNav
        contents={menu}
        title="Settings"
        subtitle="Manage your account"
        extensions={extensions}
      />
      <MainWrapper hasSecondaryNav>
        {hasAccessibleSection ? (
          <Outlet />
        ) : (
          <PageFrame hasSecondaryNav title="Settings">
            <div className="py-16 mx-auto max-w-xl text-center">
              <h2 className="mb-4 text-2xl font-light text-blue-900 dark:text-gray-100">
                No settings available
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your account doesn't have permission to view any settings sections. If you believe
                this is a mistake, please contact your administrator.
              </p>
            </div>
          </PageFrame>
        )}
      </MainWrapper>
    </>
  );
}
