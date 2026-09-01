/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test, vi } from 'vitest';
import { scopes } from '@curvenote/scms-core';

vi.mock('@curvenote/scms-server', () => ({
  userHasSiteScope: vi.fn(),
}));

import { administrationMenus } from './menu.server.js';

describe('administrationMenus', () => {
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
