// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { getPrismaClient, userHasScope } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';
import { crossrefCredentialsFromConfig } from '../../backend/crossref/client.server.js';
import { getSiteWithAppData } from '../../backend/db.server.js';
import { configureCustom } from '../../backend/doi/configure.server.js';
import { updateKindMapping } from '../../backend/doi/kinds.server.js';
import { bindRole } from '../../backend/doi/role.server.js';
import { runDoiIntent } from './actionHelper.server.js';

vi.mock('@curvenote/scms-server', () => ({
  getPrismaClient: vi.fn(async () => ({ fake: 'prisma' })),
  userHasScope: vi.fn(),
  validateFormData: vi.fn((schema: any, formData: FormData) => schema.parse(formData)),
}));
vi.mock('../../backend/crossref/client.server.js', () => ({
  crossrefCredentialsFromConfig: vi.fn(),
}));
vi.mock('../../backend/db.server.js', () => ({ getSiteWithAppData: vi.fn() }));
vi.mock('../../backend/doi/configure.server.js', () => ({
  configureCurvenote: vi.fn(),
  configureCustom: vi.fn(),
  updatePrefix: vi.fn(),
}));
vi.mock('../../backend/doi/kinds.server.js', () => ({ updateKindMapping: vi.fn() }));
vi.mock('../../backend/doi/role.server.js', () => ({
  bindRole: vi.fn(),
  unlinkRole: vi.fn(),
  resetConfig: vi.fn(),
}));

const ctx = {
  site: { id: 'site-a', name: 'science' },
  user: { id: 'user-1' },
  $config: {},
} as unknown as SiteContextWithUser;
type Rejection = { data: { error: string }; init: { status: number } };

function form(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

describe('runDoiIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(crossrefCredentialsFromConfig).mockReturnValue({ prefix: '10.62329' } as never);
    vi.mocked(getSiteWithAppData).mockResolvedValue({
      data: { doiCustomPrefixEnabled: true },
    } as never);
    // The preview feature flag is granted by default; the isSystemAdmin scope stays false, as
    // every test below already assumes.
    vi.mocked(userHasScope).mockImplementation(
      (_user, scope) => scope === scopes.app.sites.doi.feature,
    );
  });

  it('answers 403 when the user lacks the app:sites:doi:feature scope, before doing anything else', async () => {
    vi.mocked(userHasScope).mockReturnValue(false);
    const result = (await runDoiIntent(ctx, form({ intent: 'configure-curvenote' }))) as Rejection;
    expect(result.init.status).toBe(403);
    expect(vi.mocked(getPrismaClient)).not.toHaveBeenCalled();
    expect(vi.mocked(crossrefCredentialsFromConfig)).not.toHaveBeenCalled();
  });

  it('answers 400 to an unknown intent', async () => {
    const result = (await runDoiIntent(ctx, form({ intent: 'make-me-admin' }))) as Rejection;
    expect(result.init.status).toBe(400);
  });

  it('answers 500 when Crossref is not configured, without naming the fields', async () => {
    vi.mocked(crossrefCredentialsFromConfig).mockImplementation(() => {
      throw new Error('Crossref config is missing or invalid: api.crossref.password');
    });
    const result = (await runDoiIntent(ctx, form({ intent: 'configure-curvenote' }))) as Rejection;
    expect(result.init.status).toBe(500);
    expect(result.data.error).not.toContain('password');
  });

  it('passes the feature flag from site.data and the prefix to configureCustom', async () => {
    vi.mocked(configureCustom).mockResolvedValue({ ok: true, config: null });
    const result = await runDoiIntent(ctx, form({ intent: 'configure-custom', prefix: '10.5555' }));
    expect(result).toEqual({});
    expect(vi.mocked(configureCustom).mock.calls[0][1]).toEqual({
      siteId: 'site-a',
      actor: { userId: 'user-1', isSystemAdmin: false },
      customPrefixEnabled: true,
      prefix: '10.5555',
    });
  });

  it('derives isSystemAdmin from the system:admin scope, never from the form', async () => {
    vi.mocked(bindRole).mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Only a Curvenote system admin can do this.',
    });
    const result = (await runDoiIntent(
      ctx,
      form({ intent: 'bind-role', role: 'elms', occ: '0', isSystemAdmin: 'true' }),
    )) as Rejection;
    expect(vi.mocked(bindRole).mock.calls[0][1]).toMatchObject({
      actor: { userId: 'user-1', isSystemAdmin: false },
      role: 'elms',
      occ: 0,
    });
    expect(result.init.status).toBe(403);
  });

  it('maps a service failure to its status and error', async () => {
    vi.mocked(configureCustom).mockResolvedValue({
      ok: false,
      status: 400,
      error: 'Prefix not found at Crossref.',
    });
    const result = (await runDoiIntent(
      ctx,
      form({ intent: 'configure-custom', prefix: '10.5555' }),
    )) as Rejection;
    expect(result.init.status).toBe(400);
    expect(result.data).toEqual({ error: 'Prefix not found at Crossref.' });
  });

  it('answers 400 when occ is missing on an intent that needs it', async () => {
    const result = (await runDoiIntent(ctx, form({ intent: 'reset' }))) as Rejection;
    expect(result.init.status).toBe(400);
  });

  it('saves the kind mapping with the kinds and occ from the form', async () => {
    vi.mocked(updateKindMapping).mockResolvedValue({ ok: true, config: null });
    const kinds = [
      { kindId: 'kind-1', doiContentType: 'PREPRINT' },
      { kindId: 'kind-2', doiContentType: null },
    ];

    const result = await runDoiIntent(
      ctx,
      form({ intent: 'update-kind-mapping', occ: '3', kinds: JSON.stringify(kinds) }),
    );

    expect(result).toEqual({ info: 'Eligible Submission Kinds saved.' });
    expect(vi.mocked(updateKindMapping).mock.calls[0][1]).toEqual({
      siteId: 'site-a',
      actor: { userId: 'user-1', isSystemAdmin: false },
      occ: 3,
      kinds,
    });
  });

  it('answers 400 to a DOI content type Curvenote does not have', async () => {
    const kinds = [{ kindId: 'kind-1', doiContentType: 'JOURNAL_ARTICLE' }];
    const result = (await runDoiIntent(
      ctx,
      form({ intent: 'update-kind-mapping', occ: '3', kinds: JSON.stringify(kinds) }),
    )) as Rejection;

    expect(result.init.status).toBe(400);
    expect(vi.mocked(updateKindMapping)).not.toHaveBeenCalled();
  });
});
