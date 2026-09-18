import { readFileSync } from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import {
  CrossrefError,
  checkRole,
  crossrefCredentialsFromConfig,
  isRetryableCrossrefError,
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
  prefix: '10.62329',
  role: 'curv',
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

  test('throws with the status on 5xx', async () => {
    await expect(lookupPrefix('10.62329', { fetch: fakeFetch(503, 'down') })).rejects.toMatchObject(
      { status: 503 },
    );
  });

  test('throws with the status on 429', async () => {
    await expect(
      lookupPrefix('10.62329', { fetch: fakeFetch(429, 'slow down') }),
    ).rejects.toMatchObject({ status: 429 });
  });

  test('throws without a status on a network failure', async () => {
    const err = await lookupPrefix('10.62329', {
      fetch: rejectingFetch(new TypeError('fetch failed')),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err.status).toBeUndefined();
  });

  test('throws on a 200 with a non-JSON body', async () => {
    const err = await lookupPrefix('10.62329', {
      fetch: fakeFetch(200, '<html>maintenance</html>'),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err).toMatchObject({ status: 200 });
  });

  test('throws on a JSON body without the owner fields', async () => {
    await expect(
      lookupPrefix('10.62329', {
        fetch: fakeFetch(200, JSON.stringify({ message: { name: 'Curvenote Inc.' } })),
      }),
    ).rejects.toMatchObject({ status: 200, message: expect.stringContaining('unexpected body') });
  });

  test('sends a User-Agent with the contact email when one is given', async () => {
    const f = fakeFetch(200, fixture('prefixes.200-ok.json'));
    await lookupPrefix('10.62329', { fetch: f, contactEmail: 'doi@curvenote.com' });
    const init = (f as any).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('User-Agent')).toBe(
      'Curvenote-SCMS (mailto:doi@curvenote.com)',
    );
  });

  test('sends no custom headers without a contact email', async () => {
    const f = fakeFetch(200, fixture('prefixes.200-ok.json'));
    await lookupPrefix('10.62329', { fetch: f });
    expect(((f as any).mock.calls[0][1] as RequestInit).headers).toBeUndefined();
  });
});

describe('checkRole', () => {
  test('authenticated when submissionDownload answers 200 unknown_submission', async () => {
    const f = fakeFetch(200, fixture('submissionDownload.200-unknown_submission.xml'));
    expect(await checkRole(creds, 'curv', { fetch: f })).toEqual({ authenticated: true });
    const [url, init] = (f as any).mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('https://test.crossref.org/servlet/submissionDownload');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const body = new URLSearchParams(String(init.body));
    expect(body.get('usr')).toBe('doi@curvenote.com/curv');
    expect(body.get('pwd')).toBe('s3cret');
    expect(body.get('file_name')).toBeTruthy();
    expect(body.get('type')).toBe('result');
  });

  test('not authenticated on 401', async () => {
    const f = fakeFetch(401, fixture('submissionDownload.401-wrong-credentials.txt'));
    expect(await checkRole(creds, 'nope', { fetch: f })).toEqual({ authenticated: false });
    const init = (f as any).mock.calls[0][1] as RequestInit;
    expect(new URLSearchParams(String(init.body)).get('usr')).toBe('doi@curvenote.com/nope');
  });

  test('keeps the password out of the URL', async () => {
    const f = fakeFetch(200, fixture('submissionDownload.200-unknown_submission.xml'));
    await checkRole(creds, 'curv', { fetch: f });
    expect(String((f as any).mock.calls[0][0])).not.toContain('s3cret');
  });

  test('throws with the status on 503 without leaking the password', async () => {
    const err = await checkRole(creds, 'curv', { fetch: fakeFetch(503, 'maintenance') }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err.status).toBe(503);
    expect(String(err.message)).not.toContain('s3cret');
  });

  test('throws without a status on a network failure without leaking the password', async () => {
    const err = await checkRole(creds, 'curv', {
      fetch: rejectingFetch(new TypeError('fetch failed')),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err.status).toBeUndefined();
    expect(String(err.message)).not.toContain('s3cret');
  });

  test('throws on a 200 that is not a diagnostic', async () => {
    await expect(checkRole(creds, 'curv', { fetch: fakeFetch(200, '') })).rejects.toMatchObject({
      status: 200,
    });
  });

  test('throws when response.text() rejects', async () => {
    const badTextFetch = vi.fn(async () => {
      const r = new Response('', { status: 200 });
      r.text = () => Promise.reject(new TypeError('body error'));
      return r;
    }) as unknown as typeof fetch;
    const err = await checkRole(creds, 'curv', { fetch: badTextFetch }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err).toMatchObject({ status: 200, message: expect.stringContaining('unreadable') });
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

  test('names invalid fields without leaking the password', () => {
    const config = {
      api: { crossref: { ...creds, host: 'test.crossref.org', depositorEmail: 'nope' } },
    } as AppConfig;
    let message = '';
    try {
      crossrefCredentialsFromConfig(config);
    } catch (e: any) {
      message = e.message;
    }
    expect(message).toContain('api.crossref.host');
    expect(message).toContain('api.crossref.depositorEmail');
    expect(message).not.toContain('s3cret');
  });

  test('returns the Curvenote prefix and role', () => {
    const config = {
      api: { crossref: { ...creds, host: 'https://test.crossref.org/' } },
    } as unknown as AppConfig;
    expect(crossrefCredentialsFromConfig(config)).toMatchObject({
      prefix: '10.62329',
      role: 'curv',
    });
  });

  test('names the missing prefix and role, never the password', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { prefix: _p, role: _r, ...partial } = creds;
    const config = { api: { crossref: partial } } as unknown as AppConfig;
    expect(() => crossrefCredentialsFromConfig(config)).toThrow(
      /api\.crossref\.prefix.*api\.crossref\.role/,
    );
    expect(() => crossrefCredentialsFromConfig(config)).not.toThrow(/s3cret/);
  });
});

describe('isRetryableCrossrefError', () => {
  test.each([
    [new CrossrefError('network'), true],
    [new CrossrefError('busy', 429), true],
    [new CrossrefError('down', 503), true],
    [new CrossrefError('bad body', 200), false],
    [new CrossrefError('bad request', 400), false],
    [new Error('not crossref'), false],
  ])('%s -> %s', (error, expected) => {
    expect(isRetryableCrossrefError(error)).toBe(expected);
  });
});
