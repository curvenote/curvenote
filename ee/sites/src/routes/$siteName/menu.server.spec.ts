/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { scopes } from '@curvenote/scms-core';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { userHasScope, userHasSiteScope } from '@curvenote/scms-server';

vi.mock('@curvenote/scms-server', () => ({
  userHasSiteScope: vi.fn(),
  userHasScope: vi.fn(),
}));

import { administrationMenus, buildMenu } from './menu.server.js';

describe('administrationMenus', () => {
  test('includes DOI Registration for site admins only, after Submission Forms', () => {
    const menus = administrationMenus('/app/sites/science');
    const names = menus.map((item) => item.name);

    expect(menus.find((item) => item.name === 'admin.doi')).toEqual({
      name: 'admin.doi',
      label: 'DOI Registration',
      url: '/app/sites/science/doi',
      scope: scopes.site.doi.configure,
      appScope: scopes.app.sites.doi.feature,
    });
    expect(names.indexOf('admin.doi')).toBe(names.indexOf('admin.forms') + 1);
  });

  test('includes Tags gated on site:tags:list, next to kinds and collections', () => {
    const menus = administrationMenus('/app/sites/science');
    const names = menus.map((item) => item.name);

    expect(menus.find((item) => item.name === 'admin.tags')).toEqual({
      name: 'admin.tags',
      label: 'Tags',
      url: '/app/sites/science/tags',
      scope: scopes.site.tags.list,
    });
    expect(names.indexOf('admin.kinds')).toBeLessThan(names.indexOf('admin.tags'));
    expect(names.indexOf('admin.collections')).toBeLessThan(names.indexOf('admin.tags'));
  });
});

describe('buildMenu', () => {
  const ctx = {
    site: { id: 'site-a', name: 'science' },
    user: { id: 'user-1' },
    $config: {},
  } as unknown as SiteContextWithUser;

  beforeEach(() => {
    vi.clearAllMocks();
    // Every other item on the menu is gated on a site scope the user is given by default.
    vi.mocked(userHasSiteScope).mockReturnValue(true);
  });

  test('hides DOI Registration when the user lacks the app:sites:doi:feature scope', async () => {
    vi.mocked(userHasScope).mockReturnValue(false);
    const menuContents = await buildMenu(ctx);
    const names = menuContents.flatMap((section) => section.menus.map((menu) => menu.name));

    expect(names).not.toContain('admin.doi');
    expect(names).toContain('admin.forms');
    expect(vi.mocked(userHasScope).mock.calls[0]).toEqual([ctx.user, scopes.app.sites.doi.feature]);
  });

  test('shows DOI Registration when the user has both site:doi:configure and app:sites:doi:feature', async () => {
    vi.mocked(userHasScope).mockReturnValue(true);
    const menuContents = await buildMenu(ctx);
    const names = menuContents.flatMap((section) => section.menus.map((menu) => menu.name));

    expect(names).toContain('admin.doi');
  });

  test('does not require app:sites:doi:feature for items without an appScope', async () => {
    vi.mocked(userHasScope).mockReturnValue(false);
    const menuContents = await buildMenu(ctx);
    const names = menuContents.flatMap((section) => section.menus.map((menu) => menu.name));

    expect(names).toContain('admin.forms');
    expect(names).toContain('admin.users');
  });
});
