// eslint-disable-next-line import/no-extraneous-dependencies
import { vi, describe, test, expect } from 'vitest';
import { buildClientNavigation } from './utils.server.js';
import type { Context } from './backend/context.server.js';

vi.mock('./backend/loaders', async () => {
  return {
    sites: {
      list: async () => {
        return {
          items: [
            {
              name: 'agu',
              logo: 'https://cdn.curvenote.com/static/site/agu/logo.png',
              logo_dark: 'https://cdn.curvenote.com/static/site/agu/logo_dark.png',
              title: 'AGU Notebooks Now',
            },
            {
              name: 'scipy',
              logo: 'https://cdn.curvenote.com/static/site/scipy/scipy-logo.png',
              logo_dark: 'https://cdn.curvenote.com/static/site/scipy/scipy-logo-lightblue.png',
              title: 'SciPy Proceedings',
            },
          ],
        };
      },
    },
  };
});

const MockEmptyContext = { scopes: [] as string[], user: { system_role: 'USER' } } as Context;

describe('root', () => {
  describe('buildClientNavigation', () => {
    test('should return empty array when no navigation is provided', async () => {
      expect(await buildClientNavigation(MockEmptyContext)).toEqual([]);
    });
    test('should return empty array when navigation is empty', async () => {
      expect(await buildClientNavigation(MockEmptyContext)).toEqual([]);
    });
    test('should return empty array when no user is defined', async () => {
      expect(await buildClientNavigation({ scopes: [] as string[] } as Context)).toEqual([]);
    });
    test('should allow pass through of simple options', async () => {
      expect(
        await buildClientNavigation(MockEmptyContext, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          { name: 'about', label: 'About', icon: 'info', path: '/about' },
        ]),
      ).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        { name: 'about', label: 'About', icon: 'info', path: '/about' },
      ]);
    });

    test('should filter out System Admin navigation items when user dos not have ADMIN system_role', async () => {
      const contextWithoutAdmin = {
        scopes: [''],
        user: { system_role: 'USER', roles: [{ role: { scopes: ['work:create'] } }] },
      } as Context;

      expect(
        await buildClientNavigation(contextWithoutAdmin, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'admin',
            label: 'Admin',
            icon: 'settings',
            path: '/admin',
            scopes: ['system:admin'],
          },
        ]),
      ).toEqual([{ name: 'home', label: 'Home', icon: 'home', path: '/' }]);
    });

    test('should include System Admin navigation items when user has ADMIN system_role', async () => {
      const contextWithAdmin = {
        scopes: [''],
        user: {
          system_role: 'ADMIN',
          roles: [{ role: { scopes: ['work:create'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextWithAdmin, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'admin',
            label: 'Admin',
            icon: 'settings',
            path: '/admin',
            scopes: ['system:admin'],
          },
        ]),
      ).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        {
          name: 'admin',
          label: 'Admin',
          icon: 'settings',
          path: '/admin',
          scopes: ['system:admin'],
        },
      ]);
    });

    test('should include navigation items when user has a scope via a role', async () => {
      const contextWithAdmin = {
        scopes: [''],
        user: {
          system_role: 'USER',
          roles: [{ role: { scopes: ['app:platform:admin'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextWithAdmin, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'platform',
            label: 'Platform Admin',
            icon: 'settings',
            path: '/platform',
            scopes: ['app:platform:admin'],
          },
        ]),
      ).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        {
          name: 'platform',
          label: 'Platform Admin',
          icon: 'settings',
          path: '/platform',
          scopes: ['app:platform:admin'],
        },
      ]);
    });

    test('should filter our navigation items when user does not have the required scope', async () => {
      const contextWithAdmin = {
        scopes: [''],
        user: {
          system_role: 'USER',
          roles: [{ role: { scopes: ['some:other:scope'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextWithAdmin, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'platform',
            label: 'Platform Admin',
            icon: 'settings',
            path: '/platform',
            scopes: ['app:platform:admin'],
          },
        ]),
      ).toEqual([{ name: 'home', label: 'Home', icon: 'home', path: '/' }]);
    });

    test('should filter out site navigation items when user lacks required site-specific scopes', async () => {
      const contextWithSiteAccess = {
        scopes: [''],
        user: {
          system_role: 'USER',
          site_roles: [] as any[],
          roles: [{ role: { scopes: ['some:other:scope'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextWithSiteAccess, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'external-site-admin',
            label: 'External Site Admin',
            icon: 'settings',
            path: '/external-admin',
            scopes: ['site:admin:external-site'],
          },
        ]),
      ).toEqual([{ name: 'home', label: 'Home', icon: 'home', path: '/' }]);
    });

    test('should include navigation items when user has required site-specific scopes', async () => {
      const contextWithSiteAccess = {
        scopes: [''],
        user: {
          system_role: 'USER',
          site_roles: [{ site: { name: 'external-site' }, role: 'ADMIN' }],
          roles: [{ role: { scopes: ['some:other:scope'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextWithSiteAccess, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'external-site-admin',
            label: 'External Site Admin',
            icon: 'settings',
            path: '/external-admin',
            scopes: ['site:read:external-site'],
          },
        ]),
      ).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        {
          name: 'external-site-admin',
          label: 'External Site Admin',
          icon: 'settings',
          path: '/external-admin',
          scopes: ['site:read:external-site'],
        },
      ]);
    });

    test('should require ALL specified scopes to be present', async () => {
      const contextWithPartialScopes = {
        scopes: [''],
        user: {
          system_role: 'USER',
          roles: [{ role: { scopes: ['app:scope:a'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextWithPartialScopes, [
          {
            name: 'super-admin',
            label: 'Super Admin',
            icon: 'crown',
            path: '/super',
            scopes: ['app:scope:a', 'app:scope:b'],
          },
        ]),
      ).toEqual([]);
    });

    test('should filter navigation item when user is missing one of multiple required scopes', async () => {
      const contextMissingOneScope = {
        scopes: [''],
        user: {
          system_role: 'USER',
          site_roles: [{ site: { name: 'abc' }, role: 'ADMIN' }],
          roles: [{ role: { scopes: ['app:scope:a'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextMissingOneScope, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'multi-site-admin',
            label: 'Multi Site Admin',
            icon: 'crown',
            path: '/multi-admin',
            scopes: ['site:read:abc', 'app:scope:b'], // Requires BOTH scopes
          },
          {
            name: 'abc-only',
            label: 'ABC Only',
            icon: 'settings',
            path: '/abc',
            scopes: ['site:read:abc'], // Only requires ABC
          },
        ]),
      ).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        {
          name: 'abc-only',
          label: 'ABC Only',
          icon: 'settings',
          path: '/abc',
          scopes: ['site:read:abc'],
        },
        // multi-site-admin should be filtered out because user lacks 'site:admin:b'
      ]);
    });

    test('should allow system admin to see all navigation items regardless of site-specific scopes', async () => {
      const systemAdminContext = {
        scopes: ['system:admin', 'work:create'], // Has system admin but NO site-specific scopes
        user: { system_role: 'ADMIN' }, // Mock user with admin role for userHasScopes check
      } as Context;

      expect(
        await buildClientNavigation(systemAdminContext, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'abc-only',
            label: 'ABC Only',
            icon: 'lock',
            path: '/abc',
            scopes: ['site:admin:abc'],
          },
          {
            name: 'scipy-only',
            label: 'SciPy Only',
            icon: 'lock',
            path: '/scipy',
            scopes: ['site:submissions:update:scipy'],
          },
          {
            name: 'super-exclusive',
            label: 'Super Exclusive',
            icon: 'crown',
            path: '/exclusive',
            scopes: ['site:admin:abc', 'site:admin:scipy'],
          },
        ]),
      ).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        {
          name: 'abc-only',
          label: 'ABC Only',
          icon: 'lock',
          path: '/abc',
          scopes: ['site:admin:abc'],
        },
        {
          name: 'scipy-only',
          label: 'SciPy Only',
          icon: 'lock',
          path: '/scipy',
          scopes: ['site:submissions:update:scipy'],
        },
        {
          name: 'super-exclusive',
          label: 'Super Exclusive',
          icon: 'crown',
          path: '/exclusive',
          scopes: ['site:admin:abc', 'site:admin:scipy'],
        },
      ]);
    });

    test('should NOT show site-specific navigation to regular users without system admin override', async () => {
      const regularUserContext = {
        scopes: ['work:create', 'site:read:abc'], // Has some scopes but NOT site admin or system admin
        user: { system_role: 'USER' }, // Mock user with regular role
      } as Context;

      expect(
        await buildClientNavigation(regularUserContext, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'abc-admin',
            label: 'ABC Admin',
            icon: 'lock',
            path: '/abc-admin',
            scopes: ['site:admin:abc'],
          },
          {
            name: 'system-admin',
            label: 'System Admin',
            icon: 'system',
            path: '/system',
            scopes: ['system:admin'],
          },
        ]),
      ).toEqual([{ name: 'home', label: 'Home', icon: 'home', path: '/' }]);
    });
  });
});
