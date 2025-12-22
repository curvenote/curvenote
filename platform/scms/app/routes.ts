import type { RouteConfig, RouteConfigEntry } from '@react-router/dev/routes';
import { route, index, layout, prefix } from '@react-router/dev/routes';
import { getConfig, registerExtensionRoutes } from '@curvenote/scms-server';
import { extensions } from './extensions/server';
import path from 'node:path';

const environmentOverride =
  process.env.NODE_ENV !== 'production' ? process.env.NODE_ENV : undefined;

const appConfig = await getConfig({
  environmentOverride,
  directory: path.resolve(__dirname, '../../../'),
});

const authProviderNames = Object.keys(appConfig.auth ?? {});

// Pre-load all extension route registrations
const allExtensionRegistrations = await registerExtensionRoutes(appConfig, extensions);

// Helper to get routes for a specific mount point
function getRoutesForMountPoint(mountPoint: string): RouteConfigEntry[] {
  return allExtensionRegistrations
    .filter((registration) => registration.attachTo === mountPoint)
    .map((reg) => reg.register())
    .flat(1);
}

export default [
  // Resource Routes
  route('resources/set-theme', 'routes/resources.set-theme.tsx'),

  // Build Routes
  route('build/:jobId', 'routes/build.$jobId.tsx'),

  // Landing Routes
  layout('routes/_landing/route.tsx', [
    index('routes/_landing/route._index.tsx'),
    route('404', 'routes/_landing/route.404.tsx'),
    route('500', 'routes/_landing/route.500.tsx'),
    route('*', 'routes/_landing/route.$.tsx'),
  ]),

  // Auth Routes
  layout('routes/_auth/route.tsx', [
    route('link-accounts', 'routes/_auth/route.link-accounts.tsx'),
    route('auth-error', 'routes/_auth/route.auth-error.tsx'),
    route('logout', 'routes/_auth/route.logout.tsx'),
    route('signup', 'routes/_auth/route.signup.tsx'),
    route('awaiting-approval', 'routes/_auth/route.awaiting-approval.tsx'),
    route('login', 'routes/_auth/route.login.tsx', [
      index('routes/_auth/route.login._index.tsx'),
      route('admin', 'routes/_auth/route.login.admin.tsx'),
    ]),
  ]),

  // Signup routes
  route('new-account', 'routes/new-account/route.tsx', [
    route('pending', 'routes/new-account/route.pending.tsx'),
    route('check-accounts-linked', 'routes/new-account/route.check-accounts-linked.tsx'),
  ]),

  // Auth Provider Routes
  ...prefix('auth', [
    index('routes/auth._index.tsx'),
    ...authProviderNames
      .map((providerName) => {
        return [
          route(`${providerName}`, `routes/_auth/${providerName}/auth.tsx`),
          route(`${providerName}/callback`, `routes/_auth/${providerName}/auth.callback.tsx`),
        ];
      })
      .flat(),
    route('*', 'routes/auth.$.tsx'),
  ]),

  // Unsubscribe Route
  route('unsubscribe', 'routes/unsubscribe/route.tsx'),

  // Main App Routes
  route('app', 'routes/app/route.tsx', [
    // Dashboard
    route('dashboard', 'routes/app/dashboard/route.tsx'),

    // Search Routes
    route('search/users', 'routes/app/search/users.tsx'),

    // Settings Routes
    route('settings', 'routes/app/settings/route.tsx', [
      route('linked-accounts', 'routes/app/settings.linked-accounts/route.tsx'),
      route('account', 'routes/app/settings.account/route.tsx'),
      route('tokens', 'routes/app/settings.tokens/route.tsx'),
      route('emails', 'routes/app/settings.emails/route.tsx'),
    ]),

    // Discovery Routes
    route('discovery', 'routes/app/discovery/route.tsx', [
      route('people', 'routes/app/discovery.people/route.tsx'),
    ]),

    // System Routes
    route('system', 'routes/app/system/route.tsx', [
      route('submissions', 'routes/app/system.submissions/route.tsx'),
      route('add-site', 'routes/app/route.system.add-site.tsx'),
      route('migrate', 'routes/app/system.migrate/route.tsx'),
      route('storage', 'routes/app/route.system.storage.tsx'),
      route('email-test', 'routes/app/system.email-test/route.tsx'),
      route('design', 'routes/app/system.design/route.tsx'),
      route('users', 'routes/app/system.users/route.tsx'),
      route('analytics-events', 'routes/app/system.analytics-events/route.tsx'),
      route('analytics-dashboards', 'routes/app/system.analytics-dashboards/route.tsx'),
      route('roles', 'routes/app/system.roles/route.tsx'),
    ]),

    // Platform Routes
    route('platform', 'routes/app/platform/route.tsx', [
      route('users', 'routes/app/platform.users/route.tsx'),
      route('onboarding', 'routes/app/platform.onboarding/route.tsx'),
      route('workflows', 'routes/app/platform.workflows/route.tsx'),
      route('extensions', 'routes/app/platform.extensions/route.tsx'),
      route('messages', 'routes/app/platform.messages/route.tsx'),
      route('messages/:messageId', 'routes/app/platform.messages.$messageId/route.tsx'),
      route('analytics', 'routes/app/platform.analytics/route.tsx'),
    ]),

    // Register extension task route
    ...getRoutesForMountPoint('app/task'),

    // Register extension routes at the app level
    ...getRoutesForMountPoint('app'),

    // Works Routes
    ...prefix('works', [
      // Register extension routes at the works level
      ...getRoutesForMountPoint('app/works'),
      index('routes/app/works._index/route.tsx'),
      route(':workId', 'routes/app/works.$workId/route.tsx', [
        ...getRoutesForMountPoint('app/works/:workId'),
        // index('routes/app/works.$workId._index/route.tsx'),
        route('upload/:workVersionId', 'routes/app/works.$workId.upload.$workVersionId/route.tsx'),
        route('details', 'routes/app/works.$workId.details/route.tsx'),
        route('users', 'routes/app/works.$workId.users/route.tsx'),
        route('checks', 'routes/app/works.$workId.checks/route.tsx'),
        route('site', 'routes/app/route.works.$workId.site.tsx', [
          route(
            ':siteName/submission/:submissionVersionId',
            'routes/app/works.$workId.site.$siteName.submission.$submissionVersionId/route.tsx',
          ),
        ]),
      ]),
    ]),

    // Editor Routes
    route('editor', 'routes/app/editor/route.tsx'),

    // Help Request Route
    route('request-help', 'routes/app/request-help.tsx'),

    // App Catch-all Route
    route('*', 'routes/app/route.$.tsx'),
  ]),

  // API V1 Routes
  route('v1', 'routes/api/v1.tsx', [
    route('previews/:submissionVersionId', 'routes/api/v1.previews.$submissionVersionId.tsx'),

    // My Routes
    route('my/submissions', 'routes/api/v1.my.submissions.tsx', [
      route(':submissionId', 'routes/api/v1.my.submissions.$submissionId.tsx'),
    ]),
    route('my/sites', 'routes/api/v1.my.sites.tsx'),
    route('my/works', 'routes/api/v1.my.works.tsx', [
      route(':workId', 'routes/api/v1.my.works.$workId.tsx'),
    ]),
    route('my/user', 'routes/api/v1.my.user.tsx'),

    // Token Routes
    route('tokens/session', 'routes/api/v1.tokens.session.tsx'),
    route('tokens/user', 'routes/api/v1.tokens.user.tsx'),

    // Upload Routes
    route('uploads/commit', 'routes/api/v1.uploads.commit.tsx'),
    route('uploads/stage', 'routes/api/v1.uploads.stage.tsx'),

    // Check Routes
    route('checks', 'routes/api/v1.checks.tsx', [
      route(':checkId', 'routes/api/v1.checks.$checkId.tsx', [
        route('docs', 'routes/api/v1.checks.$checkId.docs.ts'),
      ]),
    ]),

    route('sites', 'routes/api/v1.sites.tsx', [
      route(':siteName', 'routes/api/v1.sites.$siteName.tsx', [
        route('doi/:first/:second', 'routes/api/v1.sites.$siteName.doi.$first.$second.tsx'),
        route('collections', 'routes/api/v1.sites.$siteName.collections.tsx', [
          route(':collectionId', 'routes/api/v1.sites.$siteName.collections.$collectionId.tsx'),
        ]),
        route('submissions', 'routes/api/v1.sites.$siteName.submissions.tsx', [
          route(':submissionId', 'routes/api/v1.sites.$siteName.submissions.$submissionId.tsx', [
            route(
              'unpublish',
              'routes/api/v1.sites.$siteName.submissions.$submissionId.unpublish.tsx',
            ),
            route(
              'versions',
              'routes/api/v1.sites.$siteName.submissions.$submissionId.versions.tsx',
              [
                route(
                  ':versionId',
                  'routes/api/v1.sites.$siteName.submissions.$submissionId.versions.$versionId.tsx',
                ),
              ],
            ),
            route('publish', 'routes/api/v1.sites.$siteName.submissions.$submissionId.publish.tsx'),
            route('status', 'routes/api/v1.sites.$siteName.submissions.$submissionId.status.tsx'),
          ]),
          route('key/:keyName', 'routes/api/v1.sites.$siteName.submissions.key.$keyName.tsx'),
        ]),
        route('access', 'routes/api/v1.sites.$siteName.access.tsx'),
        route('kinds', 'routes/api/v1.sites.$siteName.kinds.tsx', [
          route(':kindIdOrName', 'routes/api/v1.sites.$siteName.kinds.$kindIdOrName.tsx'),
        ]),
        route('works', 'routes/api/v1.sites.$siteName.works.tsx', [
          route(
            ':workIdOrSlug/versions/:versionId/thumbnail',
            'routes/api/v1.sites.$siteName.works.$workIdOrSlug.versions.$versionId.thumbnail.tsx',
          ),
          route(
            ':workIdOrSlug/versions/:versionId/social',
            'routes/api/v1.sites.$siteName.works.$workIdOrSlug.versions.$versionId.social.tsx',
          ),
          route(
            ':workIdOrSlug/published',
            'routes/api/v1.sites.$siteName.works.$workIdOrSlug.published.tsx',
          ),
          route(
            ':workIdOrSlug/thumbnail',
            'routes/api/v1.sites.$siteName.works.$workIdOrSlug.thumbnail.tsx',
          ),
          route(
            ':workIdOrSlug/social',
            'routes/api/v1.sites.$siteName.works.$workIdOrSlug.social.tsx',
          ),
        ]),
        route('sign', 'routes/api/v1.sites.$siteName.sign.tsx'),
      ]),
    ]),

    // Works API Routes
    route('works', 'routes/api/v1.works.tsx', [
      route('key/:keyName', 'routes/api/v1.works.key.$keyName.tsx'),
      route(':workId', 'routes/api/v1.works.$workId.tsx', [
        route('thumbnail', 'routes/api/v1.works.$workId.thumbnail.tsx'),
        route('versions', 'routes/api/v1.works.$workId.versions.tsx'),
      ]),
    ]),

    // Jobs API Routes
    route('jobs', 'routes/api/v1.jobs.tsx'),
    route('jobs/:jobId', 'routes/api/v1.jobs.$jobId.tsx'),

    route('keys', 'routes/api/v1.keys.tsx'),
    route('config', 'routes/api/v1.config.tsx'),
    route('login', 'routes/api/v1.login.tsx'),

    // Hooks Routes
    ...prefix('hooks', getRoutesForMountPoint('v1/hooks')),

    // DNS Router Routes
    route('routers', 'routes/api/v1.routers.tsx', [
      route(':domain', 'routes/api/v1.routers.$domain.tsx'),
    ]),

    // Analytics Routes
    route('ping', 'routes/api/v1.ping.tsx'),

    // Magic Link Routes
    route('magic/:linkId', 'routes/api/v1.magic.$linkId.tsx'),

    // API Catch-all Route
    route('*', 'routes/api/v1.$.tsx'),
  ]),
] satisfies RouteConfig;
