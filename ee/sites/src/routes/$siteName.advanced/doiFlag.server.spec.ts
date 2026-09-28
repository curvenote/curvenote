// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient, userHasScope } from '@curvenote/scms-server';
import { actionSetDoiCustomPrefixEnabled } from './doiFlag.server.js';

// Mock the server package outright (see the website route spec for why): the action needs
// only these three. withValidFormData is reduced to "parse, then run".
vi.mock('@curvenote/scms-server', () => ({
  getPrismaClient: vi.fn(),
  userHasScope: vi.fn(),
  withValidFormData: vi.fn(async (schema: any, formData: FormData, fn: any) =>
    fn(schema.parse(formData)),
  ),
}));

const ctx = { site: { id: 'site-a' }, user: { id: 'user-1' } } as unknown as SiteContext;
type Rejection = { data: { error: string }; init: { status: number } };

function form(checked: boolean) {
  const formData = new FormData();
  formData.append('formAction', 'set-doi-custom-prefix');
  if (checked) {
    formData.append('doiCustomPrefixEnabled', 'doiCustomPrefixEnabled');
  }
  return formData;
}

describe('actionSetDoiCustomPrefixEnabled', () => {
  let site: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    site = { findUnique: vi.fn(), update: vi.fn() };
    vi.mocked(getPrismaClient).mockResolvedValue({ site } as never);
  });

  it('answers 403 to anyone who is not a system admin and writes nothing', async () => {
    vi.mocked(userHasScope).mockReturnValue(false);
    const result = (await actionSetDoiCustomPrefixEnabled(ctx, form(true))) as Rejection;
    expect(result.init.status).toBe(403);
    expect(vi.mocked(userHasScope).mock.calls[0][1]).toBe('system:admin');
    expect(site.update).not.toHaveBeenCalled();
  });

  it('merges the flag into site.data without clobbering other keys', async () => {
    vi.mocked(userHasScope).mockReturnValue(true);
    site.findUnique.mockResolvedValue({ data: { magicLinksEnabled: true } });
    const result = await actionSetDoiCustomPrefixEnabled(ctx, form(true));
    expect(result).toEqual({ info: 'Own DOI prefix enabled for this Site' });
    expect(site.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'site-a' },
      data: { data: { magicLinksEnabled: true, doiCustomPrefixEnabled: true } },
    });
  });

  it('turns the flag off when the checkbox is absent', async () => {
    vi.mocked(userHasScope).mockReturnValue(true);
    site.findUnique.mockResolvedValue({ data: null });
    await actionSetDoiCustomPrefixEnabled(ctx, form(false));
    expect(site.update.mock.calls[0][0].data.data).toEqual({ doiCustomPrefixEnabled: false });
  });
});
