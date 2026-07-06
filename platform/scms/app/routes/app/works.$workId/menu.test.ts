// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { buildMenu } from './menu';
import { scopes } from '@curvenote/scms-core';

const baseUrl = '/app/works/work-1';

function makeSubmission(siteName: string, siteTitle: string, versionId: string, logo?: string) {
  return {
    site: { name: siteName, title: siteTitle, metadata: logo ? { logo } : {} },
    versions: [{ id: versionId }],
  } as Parameters<typeof buildMenu>[2][number];
}

describe('buildMenu', () => {
  it('groups site submissions under a nested Submissions item', () => {
    const menu = buildMenu(
      baseUrl,
      false,
      [
        makeSubmission('biorxiv', 'BioRxiv', 'sv-1', 'https://example.com/biorxiv.png'),
        makeSubmission('pmc', 'PMC', 'sv-2'),
      ],
      [scopes.app.works.checks.feature],
    );

    const items = menu[0].menus;
    const submissionsItem = items.find((item) => item.name === 'work.submissions');

    expect(submissionsItem).toMatchObject({
      name: 'work.submissions',
      label: 'Submissions',
      subMenus: [
        {
          label: 'BioRxiv',
          url: `${baseUrl}/site/biorxiv/submission/sv-1`,
          logo: 'https://example.com/biorxiv.png',
          siteName: 'biorxiv',
        },
        {
          label: 'PMC',
          url: `${baseUrl}/site/pmc/submission/sv-2`,
          siteName: 'pmc',
        },
      ],
    });
    expect(items.filter((item) => item.name === 'biorxiv' || item.name === 'pmc')).toHaveLength(0);
  });

  it('omits Submissions when there are no submission versions', () => {
    const menu = buildMenu(baseUrl, false, [], []);

    expect(menu[0].menus.some((item) => item.name === 'work.submissions')).toBe(false);
  });

  it('skips submissions without a latest version id', () => {
    const menu = buildMenu(
      baseUrl,
      false,
      [
        {
          site: { name: 'biorxiv', title: 'BioRxiv' },
          versions: [],
        } as unknown as Parameters<typeof buildMenu>[2][number],
      ],
      [],
    );

    expect(menu[0].menus.some((item) => item.name === 'work.submissions')).toBe(false);
  });
});
