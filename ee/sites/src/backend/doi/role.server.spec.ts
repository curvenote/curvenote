// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import { bindRole, resetConfig, unlinkRole } from './role.server.js';
import { DOI_ERRORS } from './errors.js';
import { fakeFetch, makeDeps, okPrefixBody, roleOkBody, row, wroteNothing } from './testing.js';

vi.mock('@curvenote/scms-db', () => ({
  ActivityType: { SITE_DOI_CONFIG_UPDATED: 'SITE_DOI_CONFIG_UPDATED' },
}));

const admin = { userId: 'admin-1', isSystemAdmin: true };
const siteAdmin = { userId: 'user-1', isSystemAdmin: false };
const uniqueViolation = Object.assign(new Error('unique'), { code: 'P2002' });
const ownerOk = { status: 200, body: okPrefixBody('EMS (renamed)') };
const roleOk = { status: 200, body: roleOkBody };
const unauthorized = { status: 401, body: 'Wrong credentials.' };

describe('bindRole', () => {
  const input = { siteId: 'site-a', actor: admin, role: ' elms ', occ: 0 };

  test('refreshes the owner, authenticates the role and activates the site', async () => {
    const { deps, prisma } = makeDeps(fakeFetch(ownerOk, roleOk));
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    prisma.siteDoiConfig.update.mockResolvedValue(
      row({ role: 'elms', status: 'ACTIVE', prefix_owner: 'EMS (renamed)', occ: 1 }),
    );

    const result = await bindRole(deps, input);

    expect(result).toMatchObject({ ok: true, config: { status: 'ACTIVE', role: 'elms' } });
    const call = prisma.siteDoiConfig.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'cfg-1', occ: 0 });
    expect(call.data).toMatchObject({
      role: 'elms',
      prefix_owner: 'EMS (renamed)',
      status: 'ACTIVE',
    });
    expect(prisma.activity.create.mock.calls[0][0].data).toMatchObject({
      activity_by: { connect: { id: 'admin-1' } },
      data: { action: 'bind-role', config: { role: 'elms', status: 'ACTIVE' } },
    });
  });

  test('refuses anyone who is not a system admin, before reading anything', async () => {
    const { deps, prisma, fetchMock } = makeDeps();
    expect(await bindRole(deps, { ...input, actor: siteAdmin })).toMatchObject({
      status: 403,
      error: DOI_ERRORS.forbidden,
    });
    expect(prisma.siteDoiConfig.findUnique).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([
    ['no row', null],
    ['an ACTIVE row', row({ status: 'ACTIVE', role: 'old' })],
    ['a Curvenote row', row({ mode: 'CURVENOTE_PREFIX', status: 'ACTIVE', role: 'curv' })],
    ['a stale occ', row({ occ: 2 })],
  ])('refuses on %s', async (_name, existing) => {
    const { deps, prisma, fetchMock } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(existing);
    expect(await bindRole(deps, input)).toMatchObject({ status: 409, error: DOI_ERRORS.stale });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wroteNothing(prisma)).toBe(true);
  });

  test.each([
    ['the prefix vanished at Crossref', [{ status: 404, body: 'nf' }], DOI_ERRORS.prefixNotFound],
    [
      'Crossref is down on the lookup',
      [{ status: 503, body: 'x' }],
      DOI_ERRORS.crossrefUnavailable,
    ],
    ['the role is rejected', [ownerOk, unauthorized, roleOk], DOI_ERRORS.roleRejected],
    [
      'the system password is wrong',
      [ownerOk, unauthorized, unauthorized],
      DOI_ERRORS.systemCredentials,
    ],
    [
      'Crossref is down on the role check',
      [ownerOk, { status: 503, body: 'x' }],
      DOI_ERRORS.crossrefUnavailable,
    ],
  ])('writes nothing when %s', async (_name, replies, error) => {
    const { deps, prisma } = makeDeps(fakeFetch(...replies));
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    expect(await bindRole(deps, input)).toMatchObject({ ok: false, error });
    expect(wroteNothing(prisma)).toBe(true);
  });

  test('rejects a malformed role before calling Crossref', async () => {
    const { deps, prisma, fetchMock } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    expect(await bindRole(deps, { ...input, role: 'bad role' })).toMatchObject({
      status: 400,
      error: DOI_ERRORS.roleFormat,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('reports a prefix and role pair that another site already holds', async () => {
    const { deps, prisma } = makeDeps(fakeFetch(ownerOk, roleOk));
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row());
    prisma.siteDoiConfig.update.mockRejectedValue(uniqueViolation);
    expect(await bindRole(deps, input)).toMatchObject({
      status: 409,
      error: DOI_ERRORS.pairTaken,
    });
  });
});

describe('unlinkRole', () => {
  const input = { siteId: 'site-a', actor: admin, occ: 1 };
  const active = row({ status: 'ACTIVE', role: 'elms', occ: 1 });

  test('clears the role and returns the site to PENDING_ROLE', async () => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(active);
    prisma.siteDoiConfig.update.mockResolvedValue(row({ occ: 2 }));

    expect(await unlinkRole(deps, input)).toMatchObject({
      ok: true,
      config: { status: 'PENDING_ROLE', role: null },
    });
    expect(prisma.siteDoiConfig.update.mock.calls[0][0].data).toMatchObject({
      role: null,
      status: 'PENDING_ROLE',
    });
    expect(prisma.activity.create.mock.calls[0][0].data.data.action).toBe('unlink-role');
  });

  test('refuses a site admin', async () => {
    const { deps } = makeDeps();
    expect(await unlinkRole(deps, { ...input, actor: siteAdmin })).toMatchObject({ status: 403 });
  });

  test.each([
    ['no row', null],
    ['a PENDING_ROLE row', row({ occ: 1 })],
    ['a Curvenote row', row({ mode: 'CURVENOTE_PREFIX', status: 'ACTIVE', role: 'curv', occ: 1 })],
    ['a stale occ', { ...active, occ: 5 }],
  ])('refuses on %s', async (_name, existing) => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(existing);
    expect(await unlinkRole(deps, input)).toMatchObject({ status: 409 });
    expect(wroteNothing(prisma)).toBe(true);
  });
});

describe('resetConfig', () => {
  const input = { siteId: 'site-a', actor: admin, occ: 0 };

  test('deletes the row in any state and logs a null config', async () => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(
      row({ mode: 'CURVENOTE_PREFIX', status: 'ACTIVE', role: 'curv' }),
    );
    prisma.siteDoiConfig.delete.mockResolvedValue({ id: 'cfg-1' });

    expect(await resetConfig(deps, input)).toEqual({ ok: true, config: null });
    expect(prisma.siteDoiConfig.delete.mock.calls[0][0].where).toEqual({ id: 'cfg-1', occ: 0 });
    expect(prisma.activity.create.mock.calls[0][0].data.data).toEqual({
      action: 'reset',
      config: null,
    });
  });

  test.each([
    ['their own unfinished own-prefix setup', row()],
    [
      'a Curvenote-managed setup they picked',
      row({ mode: 'CURVENOTE_PREFIX', status: 'ACTIVE', role: 'curv' }),
    ],
  ])('lets a site admin start over from %s', async (_name, existing) => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(existing);
    prisma.siteDoiConfig.delete.mockResolvedValue({ id: 'cfg-1' });
    expect(await resetConfig(deps, { ...input, actor: siteAdmin })).toEqual({
      ok: true,
      config: null,
    });
    expect(prisma.activity.create.mock.calls[0][0].data.activity_by).toEqual({
      connect: { id: 'user-1' },
    });
  });

  test('refuses a site admin once Curvenote linked the role', async () => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(row({ status: 'ACTIVE', role: 'elms' }));
    expect(await resetConfig(deps, { ...input, actor: siteAdmin })).toMatchObject({
      status: 403,
      error: DOI_ERRORS.forbidden,
    });
    expect(wroteNothing(prisma)).toBe(true);
  });

  test.each([
    ['no row', null],
    ['a stale occ', row({ occ: 9 })],
  ])('refuses on %s', async (_name, existing) => {
    const { deps, prisma } = makeDeps();
    prisma.siteDoiConfig.findUnique.mockResolvedValue(existing);
    expect(await resetConfig(deps, input)).toMatchObject({ status: 409 });
    expect(wroteNothing(prisma)).toBe(true);
  });
});
