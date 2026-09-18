import { readFileSync } from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import { CrossrefError } from './client.server.js';
import { deposit } from './deposit.server.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const fakeFetch = (status: number, body: string) =>
  vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, { status }),
  );
const creds = {
  host: 'https://test.crossref.org',
  depositorEmail: 'doi@curvenote.com',
  password: 's3cret',
  prefix: '10.62329',
  role: 'curv',
};
const input = { role: 'elms', fileName: 'CN-dep.b8d0b4aa.xml', xml: '<doi_batch/>' };

describe('deposit', () => {
  test('posts the XML as a multipart upload named after file_name', async () => {
    const f = fakeFetch(200, fixture('deposit.200-success.html'));
    expect(await deposit(creds, input, { fetch: f as unknown as typeof fetch })).toEqual({
      received: true,
    });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://test.crossref.org/servlet/deposit');
    expect(init?.method).toBe('POST');
    const body = init?.body as FormData;
    expect(body.get('operation')).toBe('doMDUpload');
    expect(body.get('login_id')).toBe('doi@curvenote.com/elms');
    expect(body.get('login_passwd')).toBe('s3cret');
    const file = body.get('fname') as File;
    expect(file.name).toBe('CN-dep.b8d0b4aa.xml');
    expect(file.type).toBe('application/xml');
    expect(await file.text()).toBe('<doi_batch/>');
  });

  test('reports bad credentials on a 401', async () => {
    const f = fakeFetch(401, fixture('deposit.401-wrong-credentials.html'));
    expect(await deposit(creds, input, { fetch: f as unknown as typeof fetch })).toEqual({
      received: false,
      reason: 'unauthorized',
    });
  });

  test('throws on a 200 without SUCCESS: Crossref did not take it', async () => {
    const err = await deposit(creds, input, {
      fetch: fakeFetch(200, '') as unknown as typeof fetch,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err).toMatchObject({ status: 200 });
  });

  test('throws on a 200 whose body contains UNSUCCESSFUL, not a whole-word SUCCESS', async () => {
    const body =
      '<html><head><title>FAILURE</title></head><body><h2>UNSUCCESSFUL</h2></body></html>';
    const err = await deposit(creds, input, {
      fetch: fakeFetch(200, body) as unknown as typeof fetch,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err).toMatchObject({ status: 200 });
  });

  test('throws with the status on 503', async () => {
    await expect(
      deposit(creds, input, {
        fetch: fakeFetch(503, fixture('deposit.503-maintenance.html')) as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  test('never forwards the network error message', async () => {
    const f = vi.fn(() => Promise.reject(new TypeError('fetch failed s3cret')));
    const err = await deposit(creds, input, { fetch: f as unknown as typeof fetch }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err.status).toBeUndefined();
    expect(err.message).not.toContain('s3cret');
  });
});
