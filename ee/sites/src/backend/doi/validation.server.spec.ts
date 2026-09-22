// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { lookupOwner, resolveCustomPrefix, validateRole } from './validation.server.js';
import { DOI_ERRORS } from './errors.js';
import { fakeFetch, makeDeps, okPrefixBody, roleOkBody } from './testing.js';

describe('resolveCustomPrefix', () => {
  test('normalises, looks up the owner and identifies itself', async () => {
    const { deps, fetchMock } = makeDeps(fakeFetch({ status: 200, body: okPrefixBody('EMS') }));
    expect(await resolveCustomPrefix(deps, ' https://doi.org/10.5555/ ')).toEqual({
      ok: true,
      prefix: '10.5555',
      ownerName: 'EMS',
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.crossref.org/prefixes/10.5555');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('User-Agent')).toContain('mailto:doi@curvenote.com');
  });

  test('rejects a malformed prefix without calling Crossref', async () => {
    const { deps, fetchMock } = makeDeps();
    expect(await resolveCustomPrefix(deps, '10.12')).toEqual({
      ok: false,
      status: 400,
      error: DOI_ERRORS.prefixFormat,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects Curvenote's own prefix without calling Crossref", async () => {
    const { deps, fetchMock } = makeDeps();
    expect(await resolveCustomPrefix(deps, '10.62329')).toMatchObject({
      status: 400,
      error: DOI_ERRORS.prefixIsCurvenote,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('reports an unknown prefix', async () => {
    const { deps } = makeDeps(fakeFetch({ status: 404, body: 'Resource not found.' }));
    expect(await resolveCustomPrefix(deps, '10.5555')).toMatchObject({
      status: 400,
      error: DOI_ERRORS.prefixNotFound,
    });
  });

  test.each([[{ status: 503, body: 'down' }], [new Error('timeout')]])(
    'reports Crossref as unavailable',
    async (reply) => {
      const { deps } = makeDeps(fakeFetch(reply));
      expect(await resolveCustomPrefix(deps, '10.5555')).toMatchObject({
        status: 502,
        error: DOI_ERRORS.crossrefUnavailable,
      });
    },
  );
});

describe('lookupOwner', () => {
  test('returns the owner for a stored prefix', async () => {
    const { deps } = makeDeps(fakeFetch({ status: 200, body: okPrefixBody('EMS') }));
    expect(await lookupOwner(deps, '10.5555')).toEqual({ ok: true, ownerName: 'EMS' });
  });
});

describe('validateRole', () => {
  test('passes when Crossref authenticates the role', async () => {
    const { deps, fetchMock } = makeDeps(fakeFetch({ status: 200, body: roleOkBody }));
    expect(await validateRole(deps, 'elms')).toEqual({ ok: true });
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain(
      'usr=doi%40curvenote.com%2Felms',
    );
  });

  test('blames the role when the control login works', async () => {
    const { deps, fetchMock } = makeDeps(
      fakeFetch({ status: 401, body: 'Wrong credentials.' }, { status: 200, body: roleOkBody }),
    );
    expect(await validateRole(deps, 'elms')).toMatchObject({
      status: 400,
      error: DOI_ERRORS.roleRejected,
    });
    expect(String((fetchMock.mock.calls[1][1] as RequestInit).body)).toContain(
      'usr=doi%40curvenote.com%2Fcurv',
    );
  });

  test("blames Curvenote's credentials when the control login fails too", async () => {
    const { deps } = makeDeps(
      fakeFetch({ status: 401, body: 'Wrong credentials.' }, { status: 401, body: 'Wrong.' }),
    );
    expect(await validateRole(deps, 'elms')).toMatchObject({
      status: 502,
      error: DOI_ERRORS.systemCredentials,
    });
  });

  test('reports Crossref as unavailable on 503', async () => {
    const { deps } = makeDeps(fakeFetch({ status: 503, body: 'down' }));
    expect(await validateRole(deps, 'elms')).toMatchObject({
      status: 502,
      error: DOI_ERRORS.crossrefUnavailable,
    });
  });

  test.each([[''], ['has space'], ['semi;colon'], ['x'.repeat(65)]])(
    'rejects the malformed role %j without calling Crossref',
    async (role) => {
      const { deps, fetchMock } = makeDeps();
      expect(await validateRole(deps, role)).toMatchObject({
        status: 400,
        error: DOI_ERRORS.roleFormat,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
