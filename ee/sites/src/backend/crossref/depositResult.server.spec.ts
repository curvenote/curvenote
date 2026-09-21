import { readFileSync } from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test, vi } from 'vitest';
import { CrossrefError } from './client.server.js';
import { checkRole, fetchDepositResult, parseDepositResult } from './depositResult.server.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const fakeFetch = (status: number, body: string) =>
  vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, { status }),
  );
const rejectingFetch = (error: Error) =>
  vi.fn(() => Promise.reject(error)) as unknown as typeof fetch;
const creds = {
  host: 'https://test.crossref.org',
  depositorEmail: 'doi@curvenote.com',
  password: 's3cret',
  prefix: '10.62329',
  role: 'curv',
};
const input = { role: 'elms', fileName: 'CN-dep.b8d0b4aa.xml' };

describe('parseDepositResult', () => {
  test('unknown_submission', () => {
    expect(parseDepositResult(fixture('submissionDownload.200-unknown_submission.xml'))).toEqual({
      state: 'unknown_submission',
    });
  });

  test('queued carries Crossref submission id', () => {
    expect(parseDepositResult(fixture('submissionDownload.200-queued.xml'))).toEqual({
      state: 'queued',
      submissionId: '1735620245',
    });
  });

  test('completed with a Success record', () => {
    expect(parseDepositResult(fixture('submissionDownload.200-completed-success.xml'))).toEqual({
      state: 'completed',
      submissionId: '1735620245',
      batchId: 'b8d0b4aa-fd3b-4275-8a60-b63721778b36',
      outcome: 'success',
      records: [
        { status: 'success', doi: '10.62329/spike-b8d0b4aa', message: 'Successfully added' },
      ],
    });
  });

  test('completed with a Failure record keeps Crossref message and has no DOI', () => {
    const result = parseDepositResult(fixture('submissionDownload.200-completed-failure.xml'));
    expect(result).toMatchObject({ state: 'completed', outcome: 'failure' });
    const [record] = (
      result as { records: { status: string; doi: string | null; message: string }[] }
    ).records;
    expect(record.status).toBe('failure');
    expect(record.doi).toBeNull();
    expect(record.message).toMatch(/^Error validating schema crossref5\.3\.1\.xsd/);
  });

  test('a Warning record counts as deposited', () => {
    const xml = fixture('submissionDownload.200-completed-success.xml').replace(
      'status="Success"',
      'status="Warning"',
    );
    expect(parseDepositResult(xml)).toMatchObject({
      outcome: 'success',
      records: [{ status: 'warning' }],
    });
  });

  test.each([
    ['not XML', '<html>maintenance</html>'],
    ['an unknown batch status', '<doi_batch_diagnostic status="exploded"/>'],
    [
      'a completed batch with no records',
      '<doi_batch_diagnostic status="completed"><submission_id>1</submission_id><batch_id>b</batch_id></doi_batch_diagnostic>',
    ],
    [
      'an unknown record status',
      fixture('submissionDownload.200-completed-success.xml').replace(
        'status="Success"',
        'status="Maybe"',
      ),
    ],
    // Would otherwise surface as `submissionId: ''` and be written to DoiDeposit.
    [
      'a queued answer with an empty submission id',
      '<doi_batch_diagnostic status="queued"><submission_id /><batch_id /></doi_batch_diagnostic>',
    ],
    [
      'a completed batch with an empty batch id',
      fixture('submissionDownload.200-completed-success.xml').replace(
        '<batch_id>b8d0b4aa-fd3b-4275-8a60-b63721778b36</batch_id>',
        '<batch_id />',
      ),
    ],
  ])('throws on %s', (_name, xml) => {
    expect(() => parseDepositResult(xml)).toThrow(CrossrefError);
  });
});

describe('fetchDepositResult', () => {
  test('polls submissionDownload by file_name with the site role', async () => {
    const body = fixture('submissionDownload.200-queued.xml');
    const f = fakeFetch(200, body);
    expect(await fetchDepositResult(creds, input, { fetch: f as unknown as typeof fetch })).toEqual(
      {
        state: 'queued',
        submissionId: '1735620245',
        xml: body,
      },
    );
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe('https://test.crossref.org/servlet/submissionDownload');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      usr: 'doi@curvenote.com/elms',
      pwd: 's3cret',
      file_name: 'CN-dep.b8d0b4aa.xml',
      type: 'result',
    });
  });

  test('keeps the password out of the URL', async () => {
    const f = fakeFetch(200, fixture('submissionDownload.200-queued.xml'));
    await fetchDepositResult(creds, input, { fetch: f as unknown as typeof fetch });
    expect(String(f.mock.calls[0][0])).not.toContain('s3cret');
  });

  test('reports bad credentials on a 401 instead of throwing', async () => {
    const f = fakeFetch(401, fixture('submissionDownload.401-wrong-credentials.txt'));
    expect(await fetchDepositResult(creds, input, { fetch: f as unknown as typeof fetch })).toEqual(
      {
        state: 'unauthorized',
      },
    );
  });

  test('throws with the status on 5xx', async () => {
    await expect(
      fetchDepositResult(creds, input, {
        fetch: fakeFetch(503, 'down') as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  test('never forwards the network error message (the URL holds the password)', async () => {
    const f = vi.fn(() => Promise.reject(new TypeError('https://x?pwd=s3cret')));
    const err = await fetchDepositResult(creds, input, {
      fetch: f as unknown as typeof fetch,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossrefError);
    expect(err.message).not.toContain('s3cret');
  });
});

describe('checkRole', () => {
  test('authenticated when submissionDownload answers 200 unknown_submission', async () => {
    const f = fakeFetch(200, fixture('submissionDownload.200-unknown_submission.xml'));
    expect(await checkRole(creds, 'curv', { fetch: f as unknown as typeof fetch })).toEqual({
      authenticated: true,
    });
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
    expect(await checkRole(creds, 'nope', { fetch: f as unknown as typeof fetch })).toEqual({
      authenticated: false,
    });
    const init = (f as any).mock.calls[0][1] as RequestInit;
    expect(new URLSearchParams(String(init.body)).get('usr')).toBe('doi@curvenote.com/nope');
  });

  test('keeps the password out of the URL', async () => {
    const f = fakeFetch(200, fixture('submissionDownload.200-unknown_submission.xml'));
    await checkRole(creds, 'curv', { fetch: f as unknown as typeof fetch });
    expect(String((f as any).mock.calls[0][0])).not.toContain('s3cret');
  });

  test('throws with the status on 503 without leaking the password', async () => {
    const err = await checkRole(creds, 'curv', {
      fetch: fakeFetch(503, 'maintenance') as unknown as typeof fetch,
    }).catch((e) => e);
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
    await expect(
      checkRole(creds, 'curv', { fetch: fakeFetch(200, '') as unknown as typeof fetch }),
    ).rejects.toMatchObject({
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
