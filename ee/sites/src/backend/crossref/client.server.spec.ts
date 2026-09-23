import { readFileSync } from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import { CrossrefError, crossrefCredentialsFromConfig, lookupPrefix } from './client.server.js';

// ee/sites is ESM ("type": "module"), so resolve fixtures from import.meta.url, not __dirname.
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const fakeFetch = (status: number, body: string) =>
  vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
const rejectingFetch = (error: Error) =>
  vi.fn(() => Promise.reject(error)) as unknown as typeof fetch;
const creds = {
  host: 'https://crossref.example.com',
  depositorEmail: 'doi@curvenote.com',
  password: 's3cret',
  prefix: '10.62329',
  role: 'curv',
  resourceUrlBase: 'https://doi.example.com',
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

describe('crossrefCredentialsFromConfig', () => {
  test('throws when api.crossref is missing', () => {
    expect(() => crossrefCredentialsFromConfig({ api: {} } as AppConfig)).toThrow(/api\.crossref/);
  });

  test('strips a trailing slash from the host and the resource URL base', () => {
    const config = {
      api: {
        crossref: {
          ...creds,
          host: 'https://crossref.example.com/',
          resourceUrlBase: 'https://doi.example.com/',
        },
      },
    } as AppConfig;
    const parsed = crossrefCredentialsFromConfig(config);
    expect(parsed.host).toBe('https://crossref.example.com');
    expect(parsed.resourceUrlBase).toBe('https://doi.example.com');
  });

  test('names invalid fields without leaking the password', () => {
    const config = {
      api: { crossref: { ...creds, host: 'crossref.example.com', depositorEmail: 'nope' } },
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
      api: { crossref: { ...creds, host: 'https://crossref.example.com/' } },
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

  test('refuses test.crossref.org unless allowTestHost is set', () => {
    const config = {
      api: { crossref: { ...creds, host: 'https://test.crossref.org' } },
    } as AppConfig;
    expect(() => crossrefCredentialsFromConfig(config)).toThrow(
      'api.crossref.host (test.crossref.org needs api.crossref.allowTestHost: true)',
    );
  });

  test('accepts test.crossref.org with allowTestHost', () => {
    const config = {
      api: { crossref: { ...creds, host: 'https://test.crossref.org/', allowTestHost: true } },
    } as AppConfig;
    expect(crossrefCredentialsFromConfig(config).host).toBe('https://test.crossref.org');
  });

  test('accepts any other host without the flag', () => {
    const config = {
      api: { crossref: { ...creds, host: 'https://doi.crossref.org' } },
    } as AppConfig;
    expect(crossrefCredentialsFromConfig(config).host).toBe('https://doi.crossref.org');
  });

  test('refuses test.crossref.org with a trailing slash too', () => {
    const config = {
      api: { crossref: { ...creds, host: 'https://test.crossref.org/' } },
    } as AppConfig;
    expect(() => crossrefCredentialsFromConfig(config)).toThrow(/allowTestHost/);
  });
});
