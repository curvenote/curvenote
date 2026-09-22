// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import { configureCurvenote, configureCustom, updatePrefix } from './configure.server.js';
import { DOI_ERRORS } from './errors.js';
import { fakeFetch, makeDeps, okPrefixBody, row, wroteNothing } from './testing.js';

// The real package boots Prisma and the pg adapter; the service only needs the enum value.
vi.mock('@curvenote/scms-db', () => ({
  ActivityType: { SITE_DOI_CONFIG_UPDATED: 'SITE_DOI_CONFIG_UPDATED' },
}));

const actor = { userId: 'user-1', isSystemAdmin: false };
const uniqueViolation = Object.assign(new Error('unique'), { code: 'P2002' });
const notFound = Object.assign(new Error('not found'), { code: 'P2025' });

describe('configureCurvenote', () => {
  test("creates an ACTIVE row with Curvenote's prefix and role, without calling Crossref", async () => {
    const { deps, prisma, fetchMock } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(null);
    const created = row({
      mode: 'CURVENOTE_PREFIX',
      prefix: '10.62329',
      prefix_owner: null,
      role: 'curv',
      status: 'ACTIVE',
    });
    prisma.siteDoiConfig.create.mockResolvedValue(created);

    const result = await configureCurvenote(deps, { siteId: 'site-a', actor });

    expect(result).toMatchObject({ ok: true, config: { status: 'ACTIVE', prefix: '10.62329' } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.siteDoiConfig.create.mock.calls[0][0].data).toMatchObject({
      site: { connect: { id: 'site-a' } },
      mode: 'CURVENOTE_PREFIX',
      prefix: '10.62329',
      prefix_owner: null,
      role: 'curv',
      status: 'ACTIVE',
    });
    expect(prisma.activity.create.mock.calls[0][0].data).toMatchObject({
      activity_by: { connect: { id: 'user-1' } },
      site: { connect: { id: 'site-a' } },
      activity_type: 'SITE_DOI_CONFIG_UPDATED',
      data: {
        action: 'configure-curvenote',
        config: { mode: 'CURVENOTE_PREFIX', prefix: '10.62329', role: 'curv', status: 'ACTIVE' },
      },
    });
  });

  test('refuses when the site is already configured', async () => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    expect(await configureCurvenote(deps, { siteId: 'site-a', actor })).toMatchObject({
      status: 409,
      error: DOI_ERRORS.stale,
    });
    expect(wroteNothing(prisma)).toBe(true);
  });

  test('treats a concurrent create (unique site_id) as stale', async () => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(null);
    prisma.siteDoiConfig.create.mockRejectedValue(uniqueViolation);
    expect(await configureCurvenote(deps, { siteId: 'site-a', actor })).toMatchObject({
      status: 409,
      error: DOI_ERRORS.stale,
    });
  });
});

describe('configureCustom', () => {
  const input = { siteId: 'site-a', actor, customPrefixEnabled: true, prefix: 'doi:10.5555' };

  test('creates a PENDING_ROLE row with the normalised prefix and its owner', async () => {
    const { deps, prisma } = makeDeps(fakeFetch({ status: 200, body: okPrefixBody('EMS') }));
    prisma.siteDoiConfig.findUnique.mockResolvedValue(null);
    prisma.siteDoiConfig.create.mockResolvedValue(row({ prefix_owner: 'EMS' }));

    const result = await configureCustom(deps, input);

    expect(result).toMatchObject({ ok: true, config: { status: 'PENDING_ROLE' } });
    expect(prisma.siteDoiConfig.create.mock.calls[0][0].data).toMatchObject({
      mode: 'CUSTOM_PREFIX',
      prefix: '10.5555',
      prefix_owner: 'EMS',
      role: null,
      status: 'PENDING_ROLE',
    });
    expect(prisma.activity.create.mock.calls[0][0].data.data.action).toBe('configure-custom');
  });

  test('refuses when the feature flag is off, before anything else', async () => {
    const { deps, prisma, fetchMock } = makeDeps();
    const result = await configureCustom(deps, { ...input, customPrefixEnabled: false });
    expect(result).toMatchObject({ status: 403, error: DOI_ERRORS.customDisabled });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.siteDoiConfig.findUnique).not.toHaveBeenCalled();
  });

  test('refuses when the site is already configured', async () => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    expect(await configureCustom(deps, input)).toMatchObject({ status: 409 });
    expect(wroteNothing(prisma)).toBe(true);
  });

  test.each([
    ['a malformed prefix', '10.12', [], DOI_ERRORS.prefixFormat],
    ["Curvenote's prefix", '10.62329', [], DOI_ERRORS.prefixIsCurvenote],
    ['an unknown prefix', '10.5555', [{ status: 404, body: 'nf' }], DOI_ERRORS.prefixNotFound],
    ['Crossref down', '10.5555', [{ status: 503, body: 'x' }], DOI_ERRORS.crossrefUnavailable],
  ])('writes nothing on %s', async (_name, prefix, replies, error) => {
    const { deps, prisma } = makeDeps(fakeFetch(...replies));
    prisma.siteDoiConfig.findUnique.mockResolvedValue(null);
    expect(await configureCustom(deps, { ...input, prefix })).toMatchObject({ ok: false, error });
    expect(wroteNothing(prisma)).toBe(true);
  });
});

describe('updatePrefix', () => {
  const input = { siteId: 'site-a', actor, customPrefixEnabled: true, prefix: '10.7777', occ: 0 };

  test('updates the prefix and owner while PENDING_ROLE, guarded by occ', async () => {
    const { deps, prisma } = makeDeps(fakeFetch({ status: 200, body: okPrefixBody('Other') }));
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    prisma.siteDoiConfig.update.mockResolvedValue(
      row({ prefix: '10.7777', prefix_owner: 'Other', occ: 1 }),
    );

    const result = await updatePrefix(deps, input);

    expect(result).toMatchObject({ ok: true, config: { prefix: '10.7777', occ: 1 } });
    const call = prisma.siteDoiConfig.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'cfg-1', occ: 0 });
    expect(call.data).toMatchObject({
      prefix: '10.7777',
      prefix_owner: 'Other',
      occ: { increment: 1 },
    });
    expect(prisma.activity.create.mock.calls[0][0].data.data.action).toBe('update-prefix');
  });

  test.each([
    ['no row', null],
    ['an ACTIVE row', row({ status: 'ACTIVE', role: 'elms' })],
    ['a NEEDS_ATTENTION row', row({ status: 'NEEDS_ATTENTION', role: 'elms' })],
    ['a Curvenote row', row({ mode: 'CURVENOTE_PREFIX', status: 'ACTIVE' })],
    ['a stale occ', row({ occ: 3 })],
  ])('refuses on %s', async (_name, existing) => {
    const { deps, prisma, fetchMock } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(existing);
    expect(await updatePrefix(deps, input)).toMatchObject({ status: 409, error: DOI_ERRORS.stale });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wroteNothing(prisma)).toBe(true);
  });

  test('refuses when the feature flag is off', async () => {
    const { deps } = makeDeps();
    expect(await updatePrefix(deps, { ...input, customPrefixEnabled: false })).toMatchObject({
      status: 403,
    });
  });

  test('maps a row that changed between read and write to stale', async () => {
    const { deps, prisma } = makeDeps(fakeFetch({ status: 200, body: okPrefixBody('Other') }));
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    prisma.siteDoiConfig.update.mockRejectedValue(notFound);
    expect(await updatePrefix(deps, input)).toMatchObject({ status: 409, error: DOI_ERRORS.stale });
  });
});
