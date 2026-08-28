/**
 * Handshake tokens must be able to update submission status (job callbacks)
 * without holding site:submissions:update on the site — matching withAPISiteContext.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Context } from './context.server.js';

const withContext = vi.fn();
const dbGetSite = vi.fn();
const dbGetSubmission = vi.fn();
const dbGetWork = vi.fn();

vi.mock('./context.server.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    withContext: (...args: unknown[]) => withContext(...args),
  };
});

vi.mock('./loaders/sites/get.server.js', () => ({
  dbGetSite: (...args: unknown[]) => dbGetSite(...args),
  dbGetUserSiteRoles: vi.fn(),
}));

vi.mock('./loaders/sites/submissions/get.server.js', () => ({
  dbGetSubmission: (...args: unknown[]) => dbGetSubmission(...args),
  formatSubmissionDTO: vi.fn(),
}));

vi.mock('./loaders/works/get.server.js', () => ({
  dbGetWork: (...args: unknown[]) => dbGetWork(...args),
  dbGetUserWorkRoles: vi.fn(),
  formatWorkDTO: vi.fn(),
  getCanonicalOrLatestVersion: vi.fn(),
}));

vi.mock('./loaders/sites/submissions/versions/get.server.js', () => ({
  formatSubmissionVersionDTO: vi.fn(),
}));

import { withAPISubmissionContext } from './context.submission.server.js';
import { site } from '@curvenote/scms-core';

const siteRow = {
  id: 'site-1',
  name: 'pmc',
  private: true,
  restricted: true,
  metadata: { title: 'PMC' },
};

const submissionRow = {
  id: 'sub-1',
  work_id: 'work-1',
  versions: [],
};

const workRow = { id: 'work-1', versions: [] };

function makeArgs() {
  return {
    params: { siteName: 'pmc', submissionId: 'sub-1' },
    request: new Request('https://example.com/v1/sites/pmc/submissions/sub-1/status', {
      method: 'PUT',
    }),
  } as any;
}

function makeHandshakeContext(request: Request, handshake: boolean) {
  const ctx = new Context({ api: {}, app: {} } as any, {} as any, {} as any, request);
  ctx.user = {
    id: 'sa-1',
    system_role: null,
    site_roles: [],
    work_roles: [],
  } as any;
  if (handshake) {
    (ctx as any).$verifiedHandshakeToken = 'handshake-token';
    (ctx as any).$handshakeClaims = {
      audience: 'jobs',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      jobId: 'job-1',
    };
  }
  return ctx;
}

describe('withAPISubmissionContext handshake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGetSite.mockResolvedValue(siteRow);
    dbGetSubmission.mockResolvedValue(submissionRow);
    dbGetWork.mockResolvedValue(workRow);
  });

  test('allows handshake without site scopes when allowHandshake is true', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeHandshakeContext(args.request, true));

    const ctx = await withAPISubmissionContext(args, [site.submissions.update], {
      allowHandshake: true,
    });

    expect(ctx.submission.id).toBe('sub-1');
    expect(ctx.site.name).toBe('pmc');
  });

  test('rejects handshake when allowHandshake is not set', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeHandshakeContext(args.request, true));

    // Falls through to withAppSubmissionContext; SA has no site scopes → 404
    await expect(withAPISubmissionContext(args, [site.submissions.update])).rejects.toMatchObject({
      status: 404,
    });
  });

  test('still 404s when submission is missing even with handshake', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeHandshakeContext(args.request, true));
    dbGetSubmission.mockResolvedValue(null);

    await expect(
      withAPISubmissionContext(args, [site.submissions.update], {
        allowHandshake: true,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
