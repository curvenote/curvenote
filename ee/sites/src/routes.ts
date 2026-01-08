import type { RouteConfigEntry } from '@react-router/dev/routes';
import type { RouteRegistration } from '@curvenote/scms-core';
import { route, index } from '@react-router/dev/routes';
import { registerExtensionRoutes, resolveRoutePath } from '@curvenote/scms-server';

export async function registerRoutes(appConfig: AppConfig): Promise<RouteRegistration[]> {
  // const allExtensionRegistrations = await registerExtensionRoutes(appConfig);

  // // Helper to get routes for a specific mount point
  // function getRoutesForMountPoint(mountPoint: string): RouteConfigEntry[] {
  //   return allExtensionRegistrations
  //     .filter((registration) => registration.attachTo === mountPoint)
  //     .map((reg) => reg.register())
  //     .flat(1);
  // }

  return [
    {
      attachTo: 'app',
      register: () =>
        [
          route('sites', resolveRoutePath(import.meta.url, 'routes/sites/route.tsx'), [
            // ...getRoutesForMountPoint('app/sites'),
            route(':siteName', resolveRoutePath(import.meta.url, 'routes/$siteName/route.tsx'), [
              // ...getRoutesForMountPoint('app/sites/:siteName'),
              index(resolveRoutePath(import.meta.url, 'routes/$siteName._index.tsx')),
              route('inbox', resolveRoutePath(import.meta.url, 'routes/$siteName.inbox/route.tsx')),
              route(
                'kinds-classic',
                resolveRoutePath(import.meta.url, 'routes/$siteName.kinds-classic/route.tsx'),
              ),
              route('kinds', resolveRoutePath(import.meta.url, 'routes/$siteName.kinds/route.tsx')),
              route(
                'kinds/:kindName',
                resolveRoutePath(import.meta.url, 'routes/$siteName.kinds.$kindName/route.tsx'),
              ),
              route('users', resolveRoutePath(import.meta.url, 'routes/$siteName.users/route.tsx')),
              route(
                'collections-classic',
                resolveRoutePath(import.meta.url, 'routes/$siteName.collections-classic/route.tsx'),
              ),
              route(
                'collections',
                resolveRoutePath(import.meta.url, 'routes/$siteName.collections/route.tsx'),
              ),
              route(
                'collections/:collectionName',
                resolveRoutePath(
                  import.meta.url,
                  'routes/$siteName.collections.$collectionName/route.tsx',
                ),
              ),
              route('forms', resolveRoutePath(import.meta.url, 'routes/$siteName.forms/route.tsx')),
              route(
                'forms/:formName',
                resolveRoutePath(import.meta.url, 'routes/$siteName.forms.$formName/route.tsx'),
              ),
              route(
                'submit/:formName',
                resolveRoutePath(import.meta.url, 'routes/$siteName.submit.$formName/route.tsx'),
              ),
              route(
                'submit/:formName/success',
                resolveRoutePath(
                  import.meta.url,
                  'routes/$siteName.submit.$formName.success/route.tsx',
                ),
              ),
              route(
                'submissions',
                resolveRoutePath(import.meta.url, 'routes/$siteName.submissions/route.tsx'),
                [
                  // ...getRoutesForMountPoint('app/sites/:siteName/submissions'),
                  index(
                    resolveRoutePath(
                      import.meta.url,
                      'routes/$siteName.submissions._index/route.tsx',
                    ),
                  ),
                  route(
                    ':submissionId',
                    resolveRoutePath(
                      import.meta.url,
                      'routes/$siteName.submissions.$submissionId/route.tsx',
                    ),
                  ),
                ],
              ),
              route(
                'advanced',
                resolveRoutePath(import.meta.url, 'routes/$siteName.advanced/route.tsx'),
              ),
              route(
                'analytics',
                resolveRoutePath(import.meta.url, 'routes/$siteName.analytics/route.tsx'),
              ),
              route(
                'domains',
                resolveRoutePath(import.meta.url, 'routes/$siteName.domains/route.tsx'),
              ),
              route(
                'website',
                resolveRoutePath(import.meta.url, 'routes/$siteName.website/route.tsx'),
              ),
              route(
                'website-classic',
                resolveRoutePath(import.meta.url, 'routes/$siteName.website-classic/route.tsx'),
              ),
            ]),
          ]),
        ] satisfies RouteConfigEntry[],
    },
  ];
}
