import { readFileSync } from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import {
  CrossrefError,
  checkRole,
  crossrefCredentialsFromConfig,
  lookupPrefix,
} from './client.server.js';

// ee/sites is ESM ("type": "module"), so resolve fixtures from import.meta.url, not __dirname.
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const fakeFetch = (status: number, body: string) =>
  vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
const rejectingFetch = (error: Error) =>
  vi.fn(() => Promise.reject(error)) as unknown as typeof fetch;
const creds = {
  host: 'https://test.crossref.org',
  depositorEmail: 'doi@curvenote.com',
  password: 's3cret',
};

describe('lookupPrefix', () => {
  test('returns the owner name for a known prefix', async () => {
    const f = fakeFetch(200, fixture('prefixes.200-ok.json'));
    expect(await lookupPrefix('10.62329', { fetch: f })).toEqual({
      prefix: '10.62329',
      ownerName: 'Curvenote Inc.',
      memberUrl: 'https://id.crossref.org/member/48717',
    });
    expect(String((f as any).mock.calls[0][0])).toBe('https://api.crossref.org/prefixes/10.62329');
  });

  test('returns null for an unknown prefix', async () => {
    expect(
      await lookupPrefix('10.99999999', {
        fetch: fakeFetch(404, fixture('prefixes.404-not-found.txt')),
      }),
    ).toBeNull();
  });

  test('throws a retryable error on 5xx', async () => {
    await expect(lookupPrefix('10.62329', { fetch: fakeFetch(503, 'down') })).rejects.toMatchObject(
      { retryable: true, status: 503 },
    );
  });

  test('throws a retryable error on 429', async () => {
    await expect(
      lookupPrefix('10.62329', { fetch: fakeFetch(429, 'slow down') }),
    ).rejects.toMatchObject({ retryable: true, status: 429 });
  });

  test('throws a non-retryable error on a 200 with a non-JSON body', async () => {
    const err = await lookupPrefix('10.62329', {
      fetch: fakeFetch(200, '<html>maintenance</html>'),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err).toMatchObject({ retryable: false, status: 200 });
  });
});

describe('checkRole', () => {
  test('authenticated when submissionDownload answers 200 unknown_submission', async () => {
    const f = fakeFetch(200, fixture('submissionDownload.200-unknown_submission.xml'));
    expect(await checkRole(creds, 'curv', { fetch: f })).toEqual({ authenticated: true });
    const url = new URL(String((f as any).mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://test.crossref.org/servlet/submissionDownload');
    expect(url.searchParams.get('usr')).toBe('doi@curvenote.com/curv');
    expect(url.searchParams.get('pwd')).toBe('s3cret');
    expect(url.searchParams.get('file_name')).toBeTruthy();
    expect(url.searchParams.get('type')).toBe('result');
  });

  test('not authenticated on 401', async () => {
    const f = fakeFetch(401, fixture('submissionDownload.401-wrong-credentials.txt'));
    expect(await checkRole(creds, 'nope', { fetch: f })).toEqual({ authenticated: false });
    const url = new URL(String((f as any).mock.calls[0][0]));
    expect(url.searchParams.get('usr')).toBe('doi@curvenote.com/nope');
  });

  test('throws a retryable error on 503 without leaking the password', async () => {
    const err = await checkRole(creds, 'curv', { fetch: fakeFetch(503, 'maintenance') }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err.retryable).toBe(true);
    expect(String(err.message)).not.toContain('s3cret');
  });

  test('throws a retryable error on a network failure without leaking the password', async () => {
    const err = await checkRole(creds, 'curv', {
      fetch: rejectingFetch(new TypeError('fetch failed')),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err.retryable).toBe(true);
    expect(String(err.message)).not.toContain('s3cret');
  });

  test('throws a non-retryable error on a 200 that is not a diagnostic', async () => {
    await expect(checkRole(creds, 'curv', { fetch: fakeFetch(200, '') })).rejects.toMatchObject({
      retryable: false,
    });
  });
});

describe('crossrefCredentialsFromConfig', () => {
  test('throws when api.crossref is missing', () => {
    expect(() => crossrefCredentialsFromConfig({ api: {} } as AppConfig)).toThrow(/api\.crossref/);
  });

  test('strips a trailing slash from the host', () => {
    const config = {
      api: { crossref: { ...creds, host: 'https://test.crossref.org/' } },
    } as AppConfig;
    expect(crossrefCredentialsFromConfig(config).host).toBe('https://test.crossref.org');
  });
});
