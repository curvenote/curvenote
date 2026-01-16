// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import { $Enums } from '@curvenote/scms-db';
import { userHasScope, userHasScopes } from './scopes.helpers.server.js';
import { site } from '@curvenote/scms-core';

function createUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-1',
    system_role: null,
    roles: [],
    site_roles: [],
    work_roles: [],
    ...overrides,
  } as any;
}

function roleWithScopes(scopes: string[]) {
  return { role: { scopes } } as any;
}

function siteRole(siteName: string, role: $Enums.SiteRole) {
  return { site: { name: siteName }, role } as any;
}

describe('userHasScope', () => {
  test('returns false when user is undefined', () => {
    expect(userHasScope(undefined, 'foo')).toBe(false);
  });

  test('returns true for system admin regardless of requested scope', () => {
    const user = createUser({ system_role: $Enums.SystemRole.ADMIN });
    expect(userHasScope(user, 'anything')).toBe(true);
  });

  test('aggregates user.role.scopes across all roles', () => {
    const user = createUser({
      roles: [roleWithScopes(['a']), roleWithScopes(['b', 'c'])],
    });
    expect(userHasScope(user, 'a')).toBe(true);
    expect(userHasScope(user, 'b')).toBe(true);
    expect(userHasScope(user, 'c')).toBe(true);
    expect(userHasScope(user, 'd')).toBe(false);
  });

  test('ignores non-array or non-string scopes fields safely', () => {
    const user = createUser({
      roles: [{ role: { scopes: null } }, { role: { scopes: [{}] } }, roleWithScopes(['ok'])],
    });
    expect(userHasScope(user, 'ok')).toBe(true);
    expect(userHasScope(user, 'bad')).toBe(false);
  });

  test('returns false for site: scope when user has no site_roles', () => {
    const user = createUser({ roles: [] });
    expect(userHasScope(user, 'site:read:mysite')).toBe(false);
  });

  test('returns false for site: scope when site_roles do not match site name', () => {
    const user = createUser({
      site_roles: [siteRole('othersite', $Enums.SiteRole.ADMIN)],
    });
    expect(userHasScope(user, `${site.read}:mysite`)).toBe(false);
  });

  test('returns true for site: scope (inferred) when matching site role has raw scope', () => {
    const user = createUser({
      site_roles: [siteRole('mysite', $Enums.SiteRole.EDITOR)],
    });
    expect(userHasScope(user, `${site.read}:mysite`)).toBe(true);
  });

  test('returns false for site: scope (inferred) when matching site role lacks raw scope', () => {
    const user = createUser({
      // REVIEWER only has site.read, so choose a scope they don't have, e.g., site.update
      site_roles: [siteRole('mysite', $Enums.SiteRole.REVIEWER)],
    });
    expect(userHasScope(user, `${site.update}:mysite`)).toBe(false);
  });

  test('handles malformed site: scopes (no site suffix) by returning false', () => {
    const user = createUser({
      site_roles: [siteRole('mysite', $Enums.SiteRole.EDITOR)],
    });
    expect(userHasScope(user, site.read)).toBe(false);
  });

  test('returns true for site override branch when siteName is provided and raw scope matches', () => {
    const user = createUser({
      site_roles: [siteRole('mysite', $Enums.SiteRole.EDITOR)],
    });
    // siteName override provided; scope is treated as raw
    expect(userHasScope(user, site.read, 'mysite')).toBe(true);
  });

  test('returns false for site override branch when raw scope does not match', () => {
    const user = createUser({
      site_roles: [siteRole('mysite', $Enums.SiteRole.REVIEWER)],
    });
    expect(userHasScope(user, site.update, 'mysite')).toBe(false);
  });

  test('does not strip suffix in override branch; passing suffixed scope with override returns false', () => {
    const user = createUser({
      site_roles: [siteRole('mysite', $Enums.SiteRole.EDITOR)],
    });
    // We pass a suffixed scope while also providing a siteName; code treats scope as raw
    expect(userHasScope(user, `${site.read}:othersite`, 'mysite')).toBe(false);
  });
});

describe('userHasScopes', () => {
  test('returns true when all requested scopes are satisfied', () => {
    const user = createUser({
      roles: [roleWithScopes(['x', 'y'])],
      site_roles: [siteRole('mysite', $Enums.SiteRole.EDITOR)],
    });
    expect(userHasScopes(user, ['x', `${site.read}:mysite`])).toBe(true);
  });

  test('returns false when any requested scope is not satisfied', () => {
    const user = createUser({ roles: [roleWithScopes(['x'])] });
    expect(userHasScopes(user, ['x', 'y'])).toBe(false);
  });

  test('returns false when user is undefined', () => {
    expect(userHasScopes(undefined, ['a'])).toBe(false);
  });
});
