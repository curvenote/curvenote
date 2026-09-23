// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withAppSiteContext: vi.fn(),
  userHasScope: vi.fn(),
  loadDoiRegistrationView: vi.fn(),
}));
vi.mock('@curvenote/scms-server', () => ({
  withAppSiteContext: mocks.withAppSiteContext,
  userHasScope: mocks.userHasScope,
}));
vi.mock('../$siteName.submissions.$submissionId/doiRegistration.server.js', () => ({
  loadDoiRegistrationView: mocks.loadDoiRegistrationView,
}));

import { loader } from './route.js';

const args = (submissionId = 'sub-1') =>
  ({ params: { siteName: 'agu', submissionId }, request: new Request('http://x') }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withAppSiteContext.mockResolvedValue({ site: { id: 'site-a' }, user: { id: 'u1' } });
  mocks.userHasScope.mockReturnValue(true);
});

async function body(response: any) {
  return response.data ?? response;
}

describe('doi-status loader', () => {
  it('returns the refresh key of the site registration', async () => {
    mocks.loadDoiRegistrationView.mockResolvedValue({
      status: 'SUBMITTING',
      doi: 'd',
      phase: 'waiting',
      retried: false,
    });
    expect(await body(await loader(args()))).toEqual({ key: 'SUBMITTING:waiting' });
    expect(mocks.loadDoiRegistrationView).toHaveBeenCalledWith('site-a', 'sub-1');
    // A JSON poller can't follow a redirect and parse it as JSON, so a scope refusal must be a
    // hard status, not withAppSiteContext's page-navigation default.
    expect(mocks.withAppSiteContext).toHaveBeenCalledWith(expect.anything(), ['site:doi:read'], {
      redirect: false,
    });
  });

  it('returns a null key once the registration settled', async () => {
    mocks.loadDoiRegistrationView.mockResolvedValue({ status: 'REGISTERED', doi: 'd' });
    expect(await body(await loader(args()))).toEqual({ key: null });
  });

  it('refuses without the DOI feature', async () => {
    mocks.userHasScope.mockReturnValue(false);
    const response: any = await loader(args());
    expect(response.init?.status ?? response.status).toBe(403);
    expect(mocks.loadDoiRegistrationView).not.toHaveBeenCalled();
  });
});
