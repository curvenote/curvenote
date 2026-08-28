/**
 * Coverage for withAPISubmissionContext / withAppSubmissionContext.
 *
 * Shared helpers (loadSiteAndSubmission, userHasSubmissionAccess, loadWork) are exercised
 * through both wrappers so app vs API not-found semantics stay aligned.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SiteRole, WorkRole } from '@curvenote/scms-db';
import { site, work } from '@curvenote/scms-core';
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

import { withAPISubmissionContext, withAppSubmissionContext } from './context.submission.server.js';

const siteRow = {
  id: 'site-1',
  name: 'pmc',
  private: true,
  restricted: true,
  metadata: { title: 'PMC' },
};

const publicSiteRow = {
  ...siteRow,
  id: 'site-public',
  name: 'open',
  private: false,
  restricted: false,
};

const submissionRow = {
  id: 'sub-1',
  work_id: 'work-1',
  versions: [],
};

const workRow = { id: 'work-1', versions: [] };

function makeArgs(siteName = 'pmc', submissionId = 'sub-1') {
  return {
    params: { siteName, submissionId },
    request: new Request(
      `https://example.com/v1/sites/${siteName}/submissions/${submissionId}/status`,
      { method: 'PUT' },
    ),
  } as any;
}

function makeContext(
  request: Request,
  opts: {
    handshake?: boolean;
    curvenote?: boolean;
    user?: Record<string, unknown> | null;
  } = {},
) {
  const ctx = new Context({ api: {}, app: {} } as any, {} as any, {} as any, request);
  if (opts.user === null) {
    ctx.user = undefined;
  } else if (opts.user !== undefined) {
    ctx.user = opts.user as any;
  } else {
    ctx.user = {
      id: 'user-1',
      system_role: null,
      site_roles: [],
      work_roles: [],
      disabled: false,
    } as any;
  }
  if (opts.handshake) {
    (ctx as any).$verifiedHandshakeToken = 'handshake-token';
    (ctx as any).$handshakeClaims = {
      audience: 'jobs',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      jobId: 'job-1',
    };
  }
  if (opts.curvenote) {
    (ctx as any).$verifiedCurvenoteToken = 'curvenote-token';
  }
  return ctx;
}

function userWithSiteAdmin(siteId = 'site-1', overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    system_role: null,
    site_roles: [{ site_id: siteId, site: { name: 'pmc', id: siteId }, role: SiteRole.ADMIN }],
    work_roles: [],
    roles: [],
    disabled: false,
    ...overrides,
  };
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
    withContext.mockResolvedValue(makeContext(args.request, { handshake: true }));

    const ctx = await withAPISubmissionContext(args, [site.submissions.update], {
      allowHandshake: true,
    });

    expect(ctx.submission.id).toBe('sub-1');
    expect(ctx.site.name).toBe('pmc');
  });

  test('rejects handshake when allowHandshake is not set', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeContext(args.request, { handshake: true }));

    await expect(withAPISubmissionContext(args, [site.submissions.update])).rejects.toMatchObject({
      status: 401,
    });
  });

  test('still 404s when submission is missing even with handshake', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeContext(args.request, { handshake: true }));
    dbGetSubmission.mockResolvedValue(null);

    await expect(
      withAPISubmissionContext(args, [site.submissions.update], {
        allowHandshake: true,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('withAPISubmissionContext user auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGetSite.mockResolvedValue(siteRow);
    dbGetSubmission.mockResolvedValue(submissionRow);
    dbGetWork.mockResolvedValue(workRow);
  });

  test('401 for unauthenticated caller without hitting DB lookups', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeContext(args.request, { user: null }));

    await expect(withAPISubmissionContext(args, [site.submissions.update])).rejects.toMatchObject({
      status: 401,
    });
    expect(dbGetSite).not.toHaveBeenCalled();
    expect(dbGetSubmission).not.toHaveBeenCalled();
  });

  test('401 when curvenote token is missing', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(
      makeContext(args.request, { user: userWithSiteAdmin(), curvenote: false }),
    );

    await expect(withAPISubmissionContext(args, [site.submissions.update])).rejects.toMatchObject({
      status: 401,
    });
    expect(dbGetSite).not.toHaveBeenCalled();
  });

  test('401 for disabled user even with site scope', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(
      makeContext(args.request, {
        curvenote: true,
        user: userWithSiteAdmin('site-1', { disabled: true }),
      }),
    );

    await expect(withAPISubmissionContext(args, [site.submissions.update])).rejects.toMatchObject({
      status: 401,
    });
    expect(dbGetSite).not.toHaveBeenCalled();
  });

  test('succeeds for curvenote-authorized user with matching site scope', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(
      makeContext(args.request, {
        curvenote: true,
        user: userWithSiteAdmin(),
      }),
    );

    const ctx = await withAPISubmissionContext(args, [site.submissions.update]);
    expect(ctx.submission.id).toBe('sub-1');
    expect(ctx.site.id).toBe('site-1');
  });

  test('404 when user has no matching scope', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(
      makeContext(args.request, {
        curvenote: true,
        user: {
          id: 'user-1',
          system_role: null,
          site_roles: [],
          work_roles: [],
          roles: [],
          disabled: false,
        },
      }),
    );

    await expect(withAPISubmissionContext(args, [site.submissions.update])).rejects.toMatchObject({
      status: 404,
    });
  });

  test('succeeds via work scope on a public unrestricted site', async () => {
    const args = makeArgs('open');
    dbGetSite.mockResolvedValue(publicSiteRow);
    withContext.mockResolvedValue(
      makeContext(args.request, {
        curvenote: true,
        user: {
          id: 'user-1',
          system_role: null,
          site_roles: [],
          work_roles: [{ work_id: 'work-1', user_id: 'user-1', role: WorkRole.OWNER }],
          roles: [],
          disabled: false,
        },
      }),
    );

    const ctx = await withAPISubmissionContext(args, [work.id.submissions.update]);
    expect(ctx.submission.id).toBe('sub-1');
    expect(ctx.site.id).toBe('site-public');
  });
});

describe('withAppSubmissionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGetSite.mockResolvedValue(siteRow);
    dbGetSubmission.mockResolvedValue(submissionRow);
    dbGetWork.mockResolvedValue(workRow);
  });

  test('401 when unauthenticated', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeContext(args.request, { user: null }));

    await expect(
      withAppSubmissionContext(args, [site.submissions.update], { redirect: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(dbGetSite).not.toHaveBeenCalled();
  });

  test('404 when user lacks scope (redirect disabled)', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(
      makeContext(args.request, {
        user: {
          id: 'user-1',
          system_role: null,
          site_roles: [],
          work_roles: [],
          roles: [],
          disabled: false,
        },
      }),
    );

    await expect(
      withAppSubmissionContext(args, [site.submissions.update], { redirect: false }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('succeeds with matching site scope', async () => {
    const args = makeArgs();
    withContext.mockResolvedValue(makeContext(args.request, { user: userWithSiteAdmin() }));

    const ctx = await withAppSubmissionContext(args, [site.submissions.update], {
      redirect: false,
    });
    expect(ctx.submission.id).toBe('sub-1');
  });
});
