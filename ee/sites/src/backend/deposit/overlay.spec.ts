// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { mergeFrontmatter } from './overlay.js';

describe('mergeFrontmatter', () => {
  it('lets the DB copy win per field, then project, then page', () => {
    const merged = mergeFrontmatter(
      { title: 'DB title', authors: [{ name: 'Edited Author' }] },
      { title: 'Project title', date: '2022-10-11', license: { content: { CC: true } } },
      { title: 'Page title', subtitle: 'Page subtitle', date: '2021-01-01' },
    );
    expect(merged).toEqual({
      title: 'DB title',
      subtitle: 'Page subtitle',
      date: '2022-10-11',
      license: { content: { CC: true } },
      authors: [{ name: 'Edited Author' }],
      affiliations: undefined,
    });
  });

  it('ignores non-object inputs', () => {
    expect(mergeFrontmatter(null, 'nope', undefined)).toEqual({
      title: undefined,
      subtitle: undefined,
      date: undefined,
      license: undefined,
      authors: undefined,
      affiliations: undefined,
    });
  });

  it('treats an empty authors array as absent', () => {
    const merged = mergeFrontmatter({ authors: [] }, { authors: [{ name: 'A' }] }, {});
    expect(merged.authors).toEqual([{ name: 'A' }]);
  });

  it('treats an empty object as absent, so a lower layer is not shadowed', () => {
    const merged = mergeFrontmatter(
      { license: {} },
      { license: { content: { CC: true, url: 'https://cc/by' } } },
      {},
    );
    expect(merged.license).toEqual({ content: { CC: true, url: 'https://cc/by' } });
  });
});
