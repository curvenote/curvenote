// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { userHasScope, userHasSiteScope } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';
import { crossrefCredentialsFromConfig } from '../../backend/crossref/client.server.js';
import { startRegistration } from '../../backend/registration/start.server.js';
import { actionRegisterDoi } from './doi.server.js';

vi.mock('@curvenote/scms-server', () => ({
  getPrismaClient: vi.fn(async () => ({ fake: 'prisma' })),
  userHasScope: vi.fn(),
  userHasSiteScope: vi.fn(),
}));
vi.mock('../../backend/crossref/client.server.js', () => ({
  crossrefCredentialsFromConfig: vi.fn(),
}));
vi.mock('../../backend/registration/start.server.js', () => ({
  startRegistration: vi.fn(),
}));

const ctx = {
  site: { id: 'site-a', name: 'science' },
  user: { id: 'user-1' },
  $config: {},
} as unknown as SiteContextWithUser;

type Rejection = { data: { error: string }; init?: { status: number } };
type Success = { data: { info: string }; init?: { status: number } };

describe('actionRegisterDoi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userHasSiteScope).mockReturnValue(true);
    // The preview feature flag is granted by default; the isSystemAdmin scope stays false, as
    // every test below already assumes.
    vi.mocked(userHasScope).mockImplementation(
      (_user, scope) => scope === scopes.app.sites.doi.feature,
    );
    vi.mocked(crossrefCredentialsFromConfig).mockReturnValue({ prefix: '10.62329' } as never);
  });

  it('refuses without site.doi.register', async () => {
    vi.mocked(userHasSiteScope).mockReturnValue(false);
    const result = (await actionRegisterDoi(ctx, 'sub-1')) as Rejection;
    expect(vi.mocked(userHasSiteScope)).toHaveBeenCalledWith(
      ctx.user,
      'site:doi:register',
      'site-a',
    );
    expect(result.init?.status).toBe(403);
    expect(result.data).toEqual({
      error: 'You do not have permission to register DOIs on this site.',
    });
    expect(vi.mocked(crossrefCredentialsFromConfig)).not.toHaveBeenCalled();
    expect(vi.mocked(startRegistration)).not.toHaveBeenCalled();
  });

  it('refuses without the DOI feature flag', async () => {
    vi.mocked(userHasScope).mockReturnValue(false);
    const result = (await actionRegisterDoi(ctx, 'sub-1')) as Rejection;
    expect(vi.mocked(userHasScope).mock.calls[0][1]).toBe('app:sites:doi:feature');
    expect(result.init?.status).toBe(403);
    expect(result.data).toEqual({
      error: 'DOI registration is not available for this account.',
    });
    expect(vi.mocked(crossrefCredentialsFromConfig)).not.toHaveBeenCalled();
    expect(vi.mocked(startRegistration)).not.toHaveBeenCalled();
  });

  it('reports an unconfigured deployment', async () => {
    vi.mocked(crossrefCredentialsFromConfig).mockImplementation(() => {
      throw new Error('Crossref config is missing or invalid: api.crossref.password');
    });
    const result = (await actionRegisterDoi(ctx, 'sub-1')) as Rejection;
    expect(result.init?.status).toBe(500);
    expect(result.data).toEqual({
      error: 'DOI registration is not configured on this deployment.',
    });
    expect(vi.mocked(startRegistration)).not.toHaveBeenCalled();
  });

  it("starts the registration for the URL's submission on the current site", async () => {
    vi.mocked(startRegistration).mockResolvedValue({
      ok: true,
      registrationId: 'reg-1',
      depositId: 'dep-1',
      doi: '10.1/x',
    });
    const result = (await actionRegisterDoi(ctx, 'sub-1')) as Success;
    expect(vi.mocked(startRegistration).mock.calls[0]).toEqual([
      ctx,
      { prisma: { fake: 'prisma' }, creds: { prefix: '10.62329' } },
      {
        siteId: 'site-a',
        submissionId: 'sub-1',
        actor: { userId: 'user-1', isSystemAdmin: false },
      },
    ]);
    expect(result.data).toEqual({ info: 'DOI registration started for 10.1/x.' });
  });

  it('joins blocking issues into the error', async () => {
    vi.mocked(startRegistration).mockResolvedValue({
      ok: false,
      status: 400,
      error: 'The deposit is not ready.',
      issues: [
        { severity: 'blocking', code: 'missing_title', message: 'Title is missing.' },
        { severity: 'blocking', code: 'missing_authors', message: 'No authors.' },
      ],
    });
    const result = (await actionRegisterDoi(ctx, 'sub-1')) as Rejection;
    expect(result.init?.status).toBe(400);
    expect(result.data).toEqual({
      error: 'The deposit is not ready. Title is missing. No authors.',
    });
  });

  it('passes 409 through', async () => {
    vi.mocked(startRegistration).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'A registration is already in progress.',
    });
    const result = (await actionRegisterDoi(ctx, 'sub-1')) as Rejection;
    expect(result.init?.status).toBe(409);
    expect(result.data).toEqual({ error: 'A registration is already in progress.' });
  });
});
