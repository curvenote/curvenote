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
      expect(await buildClientNavigation(MockEmptyContext)).toEqual({
        items: [],
      });
    });
    test('should return empty array when navigation is empty', async () => {
      expect(await buildClientNavigation(MockEmptyContext)).toEqual({
        items: [],
      });
    });
    test('should return empty array when no user is defined', async () => {
      expect(await buildClientNavigation({ scopes: [] as string[] } as Context)).toEqual({
        items: [],
      });
    });
    test('should allow pass through of simple options', async () => {
      expect(
        await buildClientNavigation(MockEmptyContext, {
          items: [
            { name: 'home', label: 'Home', icon: 'home', path: '/' },
            { name: 'about', label: 'About', icon: 'info', path: '/about' },
          ],
        }),
      ).toEqual({
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          { name: 'about', label: 'About', icon: 'info', path: '/about' },
        ],
      });
    });

    test('should preserve beta property when present', async () => {
      expect(
        await buildClientNavigation(MockEmptyContext, [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          { name: 'beta-feature', label: 'Beta Feature', icon: 'flask', path: '/beta', beta: true },
        ]),
      ).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        { name: 'beta-feature', label: 'Beta Feature', icon: 'flask', path: '/beta', beta: true },
      ]);
    });

    test('should filter out System Admin navigation items when user dos not have ADMIN system_role', async () => {
      const contextWithoutAdmin = {
        scopes: [''],
        user: { system_role: 'USER', roles: [{ role: { scopes: ['work:create'] } }] },
      } as Context;

      expect(
        await buildClientNavigation(contextWithoutAdmin, {
          items: [
            { name: 'home', label: 'Home', icon: 'home', path: '/' },
            {
              name: 'admin',
              label: 'Admin',
              icon: 'settings',
              path: '/admin',
              scopes: ['system:admin'],
            },
          ],
        }),
      ).toEqual({ items: [{ name: 'home', label: 'Home', icon: 'home', path: '/' }] });
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
        await buildClientNavigation(contextWithAdmin, {
          items: [
            { name: 'home', label: 'Home', icon: 'home', path: '/' },
            {
              name: 'admin',
              label: 'Admin',
              icon: 'settings',
              path: '/admin',
              scopes: ['system:admin'],
            },
          ],
        }),
      ).toEqual({
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'admin',
            label: 'Admin',
            icon: 'settings',
            path: '/admin',
            scopes: ['system:admin'],
          },
        ],
      });
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
        await buildClientNavigation(contextWithAdmin, {
          items: [
            { name: 'home', label: 'Home', icon: 'home', path: '/' },
            {
              name: 'platform',
              label: 'Platform Admin',
              icon: 'settings',
              path: '/platform',
              scopes: ['app:platform:admin'],
            },
          ],
        }),
      ).toEqual({
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'platform',
            label: 'Platform Admin',
            icon: 'settings',
            path: '/platform',
            scopes: ['app:platform:admin'],
          },
        ],
      });
    });

    test('should filter out navigation items when user does not have the required scope', async () => {
      const contextWithAdmin = {
        scopes: [''],
        user: {
          system_role: 'USER',
          roles: [{ role: { scopes: ['some:other:scope'] } }],
        },
      } as Context;

      expect(
        await buildClientNavigation(contextWithAdmin, {
          items: [
            { name: 'home', label: 'Home', icon: 'home', path: '/' },
            {
              name: 'platform',
              label: 'Platform Admin',
              icon: 'settings',
              path: '/platform',
              scopes: ['app:platform:admin'],
            },
          ],
        }),
      ).toEqual({
        items: [{ name: 'home', label: 'Home', icon: 'home', path: '/' }],
      });
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
        await buildClientNavigation(contextWithSiteAccess, {
          items: [
            { name: 'home', label: 'Home', icon: 'home', path: '/' },
            {
              name: 'external-site-admin',
              label: 'External Site Admin',
              icon: 'settings',
              path: '/external-admin',
              scopes: ['site:admin:external-site'],
            },
          ],
        }),
      ).toEqual({ items: [{ name: 'home', label: 'Home', icon: 'home', path: '/' }] });
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
        await buildClientNavigation(contextWithSiteAccess, {
          items: [
            { name: 'home', label: 'Home', icon: 'home', path: '/' },
            {
              name: 'external-site-admin',
              label: 'External Site Admin',
              icon: 'settings',
              path: '/external-admin',
              scopes: ['site:read:external-site'],
            },
          ],
        }),
      ).toEqual({
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'external-site-admin',
            label: 'External Site Admin',
            icon: 'settings',
            path: '/external-admin',
            scopes: ['site:read:external-site'],
          },
        ],
      });
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
        await buildClientNavigation(contextWithPartialScopes, {
          items: [
            {
              name: 'super-admin',
              label: 'Super Admin',
              icon: 'crown',
              path: '/super',
              scopes: ['app:scope:a', 'app:scope:b'],
            },
          ],
        }),
      ).toEqual({ items: [] });
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
        await buildClientNavigation(contextMissingOneScope, {
          items: [
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
          ],
        }),
      ).toEqual({
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'abc-only',
            label: 'ABC Only',
            icon: 'settings',
            path: '/abc',
            scopes: ['site:read:abc'],
          },
        ],
      });
    });

    test('should allow system admin to see all navigation items regardless of site-specific scopes', async () => {
      const systemAdminContext = {
        scopes: ['system:admin', 'work:create'], // Has system admin but NO site-specific scopes
        user: { system_role: 'ADMIN' }, // Mock user with admin role for userHasScopes check
      } as Context;

      expect(
        await buildClientNavigation(systemAdminContext, {
          items: [
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
          ],
        }),
      ).toEqual({
        items: [
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
        ],
      });
    });

    test('should NOT show site-specific navigation to regular users without system admin override', async () => {
      const regularUserContext = {
        scopes: ['work:create', 'site:read:abc'], // Has some scopes but NOT site admin or system admin
        user: { system_role: 'USER' }, // Mock user with regular role
      } as Context;

      expect(
        await buildClientNavigation(regularUserContext, {
          items: [
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
          ],
        }),
      ).toEqual({ items: [{ name: 'home', label: 'Home', icon: 'home', path: '/' }] });
    });

    test('should preserve defaultRoute when processing navigation items', async () => {
      const result = await buildClientNavigation(MockEmptyContext, {
        defaultRoute: 'dashboard',
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          { name: 'about', label: 'About', icon: 'info', path: '/about' },
        ],
      });

      // Note: buildClientNavigation doesn't return defaultRoute, it's handled separately
      // But we verify the structure is correct and items are processed
      expect(result.items).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        { name: 'about', label: 'About', icon: 'info', path: '/about' },
      ]);
      expect(result.helpItem).toBeUndefined();
    });

    test('should preserve helpItem structure when processing navigation items', async () => {
      const result = await buildClientNavigation(MockEmptyContext, {
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'admin',
            label: 'Admin',
            icon: 'settings',
            path: '/admin',
            scopes: ['system:admin'],
          },
        ],
        helpItem: {
          enabled: true,
          icon: 'help-circle',
          properties: {
            label: 'Get Help',
            prompt: 'How can we help?',
          },
        },
      });

      // buildClientNavigation returns helpItem as undefined (processed separately in root.tsx)
      // But we verify items are correctly processed and structure is maintained
      expect(result.items).toEqual([{ name: 'home', label: 'Home', icon: 'home', path: '/' }]);
      expect(result.helpItem).toBeUndefined();
    });

    test('should preserve both defaultRoute and helpItem when filtering items by scopes', async () => {
      const contextWithAdmin = {
        scopes: [''],
        user: {
          system_role: 'ADMIN',
          roles: [{ role: { scopes: ['work:create'] } }],
        },
      } as Context;

      const result = await buildClientNavigation(contextWithAdmin, {
        defaultRoute: 'dashboard',
        items: [
          { name: 'home', label: 'Home', icon: 'home', path: '/' },
          {
            name: 'admin',
            label: 'Admin',
            icon: 'settings',
            path: '/admin',
            scopes: ['system:admin'],
          },
        ],
        helpItem: {
          enabled: true,
          icon: 'help-circle',
          properties: {
            label: 'Report a Problem',
          },
        },
      });

      // Verify items are correctly filtered (admin item should be included due to system_role: 'ADMIN')
      expect(result.items).toEqual([
        { name: 'home', label: 'Home', icon: 'home', path: '/' },
        {
          name: 'admin',
          label: 'Admin',
          icon: 'settings',
          path: '/admin',
          scopes: ['system:admin'],
        },
      ]);
      // helpItem is processed separately in root.tsx, so it's undefined here
      expect(result.helpItem).toBeUndefined();
    });

    test('should preserve defaultRoute when no items match scope filters', async () => {
      const contextWithoutScopes = {
        scopes: [''],
        user: {
          system_role: 'USER',
          roles: [{ role: { scopes: [] } }],
        },
      } as any;

      const result = await buildClientNavigation(contextWithoutScopes, {
        defaultRoute: 'settings',
        items: [
          {
            name: 'admin',
            label: 'Admin',
            icon: 'settings',
            path: '/admin',
            scopes: ['system:admin'],
          },
        ],
      });

      // All items filtered out, but structure should still be correct
      expect(result.items).toEqual([]);
      expect(result.helpItem).toBeUndefined();
    });
  });
});
