// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import { dbListKindMappings } from './kinds.db.server.js';
import { makeDeps } from './testing.js';

// The real package boots Prisma and the pg adapter; nothing here needs it.
vi.mock('@curvenote/scms-db', () => ({
  ActivityType: { SITE_DOI_CONFIG_UPDATED: 'SITE_DOI_CONFIG_UPDATED' },
}));

describe('dbListKindMappings', () => {
  test('lists every kind of the site with its title, content type and lock', async () => {
    const { deps, prisma } = makeDeps();
    prisma.submissionKind.findMany.mockResolvedValue([
      {
        id: 'kind-article',
        name: 'Article',
        content: { title: 'Research Article' },
        doi_content_type: null,
      },
      { id: 'kind-blog', name: 'Blog', content: {}, doi_content_type: 'PREPRINT' },
    ]);
    prisma.submission.findMany.mockResolvedValue([{ kind_id: 'kind-blog' }]);

    expect(await dbListKindMappings(deps.prisma, 'site-a')).toEqual([
      { id: 'kind-article', title: 'Research Article', doiContentType: null, locked: false },
      { id: 'kind-blog', title: 'Blog', doiContentType: 'PREPRINT', locked: true },
    ]);
    expect(prisma.submission.findMany.mock.calls[0][0].where).toEqual({
      site_id: 'site-a',
      doiRegistration: { is: { status: { in: ['REGISTERED', 'SUBMITTING'] } } },
    });
  });
});
