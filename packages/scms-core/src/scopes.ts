export const system = { admin: 'system:admin' };

export const site = {
  create: 'site:create',
  list: 'site:list',
  read: 'site:read',
  update: 'site:update',
  details: 'site:details', // App only scope
  domains: {
    list: 'site:domains:list',
    create: 'site:domains:create',
    delete: 'site:domains:delete',
    update: 'site:domains:update',
  },
  submissions: {
    list: 'site:submissions:list',
    read: 'site:submissions:read',
    create: 'site:submissions:create',
    update: 'site:submissions:update',
    delete: 'site:submissions:delete',
    versions: {
      create: 'site:submissions:versions:create',
    },
  },
  publishing: 'site:submissions:publishing',
  kinds: {
    list: 'site:kinds:list',
    read: 'site:kinds:read',
    create: 'site:kinds:create',
    update: 'site:kinds:update',
    delete: 'site:kinds:delete',
  },
  collections: {
    list: 'site:collections:list',
    read: 'site:collections:read',
    create: 'site:collections:create',
    update: 'site:collections:update',
    delete: 'site:collections:delete',
  },
  forms: {
    list: 'site:forms:list',
    read: 'site:forms:read',
    create: 'site:forms:create',
    update: 'site:forms:update',
    delete: 'site:forms:delete',
  },
  users: {
    list: 'site:users:list',
    read: 'site:users',
    create: 'site:users:create',
    update: 'site:users:update',
    delete: 'site:users:delete',
  },
};

export const work = {
  list: 'work:list',
  create: 'work:create',
  read: 'work:read',
  update: 'work:update',
  submissions: {
    list: 'work:submissions:list',
    read: 'work:submissions:read',
    create: 'work:submissions:create',
    update: 'work:submissions:update',
    delete: 'work:submissions:delete',
    versions: {
      create: 'work:submissions:versions:create',
    },
  },
  users: {
    read: 'work:users',
    update: 'work:users:update',
  },
  checks: {
    read: 'work:checks:read',
    dispatch: 'work:checks:dispatch',
  },
};

// app wide feature based scopes, to be expanded in the future
export const app = {
  platform: { admin: 'app:platform:admin' },
  works: {
    feature: 'app:works:feature', // UI level feature flag
    upload: 'app:works:upload',
  },
};

export const scopes = { system, site, work, app };

/**
 * Clientside function to check if a user has any of the scopes included in the list
 * this can include a mix of system scopes or site scopes.
 *
 * @param userScopes
 * @param requestedScopes
 * @returns
 */
export function clientCheckSiteScopes(
  userScopes: string[],
  requestedScopes: string[],
  siteName: string,
): boolean {
  if (userScopes.includes(system.admin)) return true;
  const siteScopes = requestedScopes
    .filter((scope) => scope.startsWith('site:'))
    .map((s) => `${s}:${siteName}`);
  const otherScopes = requestedScopes.filter((scope) => !scope.startsWith('site:'));
  const userScopeSet = new Set(userScopes);
  return [...otherScopes, ...siteScopes].some((scope) => userScopeSet.has(scope));
}

/**
 * Takes the user scopes convenience array and returns a list of site names that
 * the user has at least one scope on.
 *
 */
export function clientGetUserSiteNames(userScopes: string[]): string[] | null {
  const siteNames = Array.from(
    new Set(
      userScopes
        .filter((scope) => scope.startsWith('site:'))
        .map((scope) => {
          const parts = scope.split(':');
          return parts[parts.length - 1];
        })
        .filter((i): i is string => !!i),
    ),
  );
  return siteNames.length > 0 ? siteNames : null;
}
