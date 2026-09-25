// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import { DOI_ERRORS, kindLocked } from './errors.js';
import { updateKindMapping } from './kinds.server.js';
import type { KindMappingEntry } from './kinds.server.js';
import { makeDeps, row, wroteNothing } from './testing.js';

// The real package boots Prisma and the pg adapter; the service only needs the enum value.
vi.mock('@curvenote/scms-db', () => ({
  ActivityType: { SITE_DOI_CONFIG_UPDATED: 'SITE_DOI_CONFIG_UPDATED' },
}));

const actor = { userId: 'user-1', isSystemAdmin: false };
const config = row({ mode: 'CURVENOTE_PREFIX', role: 'curv', status: 'ACTIVE', occ: 3 });
const article = {
  id: 'kind-article',
  name: 'Article',
  content: { title: 'Research Article' },
  doi_content_type: null,
};
const blog = { id: 'kind-blog', name: 'Blog', content: {}, doi_content_type: 'PREPRINT' };

function setup() {
  const made = makeDeps();
  made.prisma.siteDoiConfig.findUnique.mockResolvedValue(config);
  made.prisma.submissionKind.findMany.mockResolvedValue([article, blog]);
  return made;
}

function input(kinds: KindMappingEntry[]) {
  return { siteId: 'site-a', actor, kinds };
}

const bothPreprint: KindMappingEntry[] = [
  { kindId: 'kind-article', doiContentType: 'PREPRINT' },
  { kindId: 'kind-blog', doiContentType: 'PREPRINT' },
];

describe('updateKindMapping', () => {
  test('saves only the kinds that changed, leaves the DOI setup alone and logs them', async () => {
    const { deps, prisma } = setup();

    const result = await updateKindMapping(deps, input(bothPreprint));

    expect(result).toMatchObject({ ok: true, config: { occ: 3 } });
    expect(prisma.siteDoiConfig.update).not.toHaveBeenCalled();
    expect(prisma.submissionKind.update).toHaveBeenCalledTimes(1);
    expect(prisma.submissionKind.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'kind-article', site_id: 'site-a' },
      data: { doi_content_type: 'PREPRINT' },
    });
    // SubmissionKind.occ guards the `content` JSON; a plain column write leaves it alone.
    expect(prisma.submissionKind.update.mock.calls[0][0].data).not.toHaveProperty('occ');
    expect(prisma.activity.create.mock.calls[0][0].data.data).toEqual({
      action: 'update-kind-mapping',
      config: expect.objectContaining({ status: 'ACTIVE' }),
      kinds: [{ id: 'kind-article', name: 'Article', doi_content_type: 'PREPRINT' }],
    });
  });

  test('stores null for a kind that is no longer eligible', async () => {
    const { deps, prisma } = setup();

    await updateKindMapping(deps, input([{ kindId: 'kind-blog', doiContentType: null }]));

    expect(prisma.submissionKind.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'kind-blog', site_id: 'site-a' },
      data: { doi_content_type: null },
    });
  });

  test('writes nothing when nothing changed', async () => {
    const { deps, prisma } = setup();

    const result = await updateKindMapping(
      deps,
      input([{ kindId: 'kind-blog', doiContentType: 'PREPRINT' }]),
    );

    expect(result).toMatchObject({ ok: true, config: { occ: 3 } });
    expect(wroteNothing(prisma)).toBe(true);
  });

  test('checks live registrations of the changed kinds only', async () => {
    const { deps, prisma } = setup();

    await updateKindMapping(deps, input(bothPreprint));

    expect(prisma.submission.findMany.mock.calls[0][0].where).toEqual({
      site_id: 'site-a',
      kind_id: { in: ['kind-article'] },
      doiRegistration: { is: { status: { in: ['REGISTERED', 'SUBMITTING'] } } },
    });
  });

  test('refuses a kind with a registered or in-flight DOI, naming it, writing nothing', async () => {
    const { deps, prisma } = setup();
    prisma.submission.findMany.mockResolvedValue([{ kind_id: 'kind-article' }]);

    const result = await updateKindMapping(deps, input(bothPreprint));

    expect(result).toEqual(kindLocked('Research Article'));
    expect(wroteNothing(prisma)).toBe(true);
  });

  test('refuses a kind id that is not on this site, writing nothing', async () => {
    const { deps, prisma } = setup();

    const result = await updateKindMapping(
      deps,
      input([{ kindId: 'kind-of-another-site', doiContentType: 'PREPRINT' }]),
    );

    expect(result).toEqual({ ok: false, status: 400, error: DOI_ERRORS.unknownKind });
    expect(wroteNothing(prisma)).toBe(true);
  });

  test('answers stale when a kind is deleted after it was read, logging nothing', async () => {
    const { deps, prisma } = setup();
    prisma.submissionKind.update.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'P2025' }),
    );

    const result = await updateKindMapping(deps, input(bothPreprint));

    expect(result).toMatchObject({ status: 409, error: DOI_ERRORS.stale });
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  test('answers stale when the DOI setup was reset meanwhile', async () => {
    const { deps, prisma } = setup();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(null);

    const result = await updateKindMapping(deps, input(bothPreprint));

    expect(result).toMatchObject({ status: 409, error: DOI_ERRORS.stale });
    expect(wroteNothing(prisma)).toBe(true);
  });
});
