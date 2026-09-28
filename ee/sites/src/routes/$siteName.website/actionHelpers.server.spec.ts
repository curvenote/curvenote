// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient, safeSiteMetadataUpdate } from '@curvenote/scms-server';
import { $actionUpdateSiteDesign } from './actionHelpers.server.js';

// The action only needs these two from the server package. Mocking the module outright,
// rather than spreading the real one, keeps the whole server (prisma, config) out of the
// test — importing it took longer than vitest's hook timeout on CI.
vi.mock('@curvenote/scms-server', () => ({
  getPrismaClient: vi.fn(),
  safeSiteMetadataUpdate: vi.fn(),
}));

const ctx = {
  site: { id: 'site-a', metadata: {} },
  user: { id: 'user-a' },
  trackEvent: vi.fn(),
  analytics: { flush: vi.fn() },
} as unknown as SiteContext;

type Rejection = { data: { error: string }; init: { status: number } };

/** Submit the given fields to the action as a browser form post would. */
function run(fields: Record<string, string | object>) {
  const formData = new FormData();
  formData.append('intent', 'site.update');
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
  return $actionUpdateSiteDesign(ctx, formData);
}

const rejection = (result: unknown) => result as Rejection;

describe('$actionUpdateSiteDesign', () => {
  const metadataUpdate = vi.mocked(safeSiteMetadataUpdate);
  let siteUpdate: ReturnType<typeof vi.fn>;
  let activityCreate: ReturnType<typeof vi.fn>;
  /** The activity rows the action wrote, as `[type, data]`. */
  const activities = () =>
    activityCreate.mock.calls.map(([call]) => [call.data.activity_type, call.data.data]);
  /** Runs the updater the action passed in against a seed, to see what it would write. */
  const appliedMetadata = (seed: Record<string, unknown> = {}) => {
    const updater = metadataUpdate.mock.calls[0]?.[1] as
      ((metadata: Record<string, unknown>) => Record<string, unknown>) | undefined;
    if (!updater) throw new Error('metadata was not updated');
    return updater(seed);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    metadataUpdate.mockResolvedValue(undefined as never);
    siteUpdate = vi.fn();
    activityCreate = vi.fn();
    vi.mocked(getPrismaClient).mockResolvedValue({
      site: { update: siteUpdate },
      activity: { create: activityCreate },
    } as never);
  });

  describe('colors', () => {
    it('rejects a color that is not a six digit hex', async () => {
      const result = rejection(await run({ colorPrimary: 'blue' }));
      expect(result.init.status).toBe(400);
      expect(result.data.error).toMatch(/color/i);
      expect(metadataUpdate).not.toHaveBeenCalled();
    });

    it('writes valid colors into the theme config', async () => {
      await run({ colorPrimary: '#0154A5', colorSecondary: '#616161' });
      expect(appliedMetadata()).toMatchObject({
        theme_config: { colors: { primary: '#0154A5', secondary: '#616161' } },
      });
    });
  });

  describe('footer links', () => {
    const link = (title: string, url: string) => ({ title, url });

    it('rejects more than three columns', async () => {
      const result = rejection(
        await run({
          footerLinks: [[link('A', '/a')], [link('B', '/b')], [link('C', '/c')], [link('D', '/d')]],
        }),
      );
      expect(result.init.status).toBe(400);
      expect(result.data.error).toMatch(/at most 3 columns/);
      expect(metadataUpdate).not.toHaveBeenCalled();
    });

    it('rejects an empty column', async () => {
      const result = rejection(await run({ footerLinks: [[link('A', '/a')], []] }));
      expect(result.init.status).toBe(400);
      expect(result.data.error).toMatch(/at least one link/);
      expect(metadataUpdate).not.toHaveBeenCalled();
    });

    it.each([
      ['title', [[link('', '/a')]]],
      ['url', [[link('A', '')]]],
      ['whitespace title', [[link('   ', '/a')]]],
    ])('rejects a link with a blank %s', async (_label, footerLinks) => {
      const result = rejection(await run({ footerLinks }));
      expect(result.init.status).toBe(400);
      expect(metadataUpdate).not.toHaveBeenCalled();
    });

    it.each([
      ['not JSON', 'not json'],
      ['an object', { title: 'A', url: '/a' }],
      ['a column that is not an array', [{ title: 'A', url: '/a' }]],
    ])('rejects footer links that are %s', async (_label, footerLinks) => {
      const result = rejection(await run({ footerLinks }));
      expect(result.init.status).toBe(400);
      expect(metadataUpdate).not.toHaveBeenCalled();
    });

    it('writes valid columns, keeping only title, url and external', async () => {
      await run({
        footerLinks: [
          [{ ...link('Home', '/'), extra: 'dropped' }],
          [{ ...link('Docs', 'https://example.com'), external: true }],
        ],
      });
      expect(appliedMetadata().footer_links).toEqual([
        [{ title: 'Home', url: '/', external: undefined }],
        [{ title: 'Docs', url: 'https://example.com', external: true }],
      ]);
    });

    it('accepts no columns at all', async () => {
      const result = await run({ footerLinks: [] });
      expect(result).toEqual({ success: true });
      expect(appliedMetadata().footer_links).toEqual([]);
    });
  });

  describe('social links', () => {
    it('rejects a link with a blank url', async () => {
      const result = rejection(
        await run({
          socialLinks: [
            { kind: 'github', url: 'https://github.com/x' },
            { kind: 'website', url: '' },
          ],
        }),
      );
      expect(result.init.status).toBe(400);
      expect(result.data.error).toMatch(/needs a link/);
      expect(metadataUpdate).not.toHaveBeenCalled();
    });

    it('rejects a link with no kind', async () => {
      const result = rejection(await run({ socialLinks: [{ url: 'https://github.com/x' }] }));
      expect(result.init.status).toBe(400);
    });

    it.each([
      ['not JSON', 'nope'],
      ['an object', { kind: 'github', url: 'https://github.com/x' }],
    ])('rejects social links that are %s', async (_label, socialLinks) => {
      const result = rejection(await run({ socialLinks }));
      expect(result.init.status).toBe(400);
      expect(metadataUpdate).not.toHaveBeenCalled();
    });

    it('writes valid links, keeping only kind and url', async () => {
      await run({
        socialLinks: [{ kind: 'twitter', url: 'https://twitter.com/x', title: 'dropped' }],
      });
      expect(appliedMetadata().social_links).toEqual([
        { kind: 'twitter', url: 'https://twitter.com/x' },
      ]);
    });
  });

  describe('tagline', () => {
    it('writes an empty tagline so it can be cleared', async () => {
      await run({ tagline: '' });
      expect(appliedMetadata({ tagline: 'old' }).tagline).toBe('');
    });

    it('leaves the tagline alone when it is not submitted', async () => {
      await run({ colorPrimary: '#000000' });
      expect(appliedMetadata({ tagline: 'old' }).tagline).toBe('old');
    });
  });

  describe('logos and favicon', () => {
    it('writes each image url to its metadata key', async () => {
      await run({
        logoUrl: 'l',
        logoDarkUrl: 'ld',
        faviconUrl: 'f',
        footerLogoUrl: 'fl',
        footerLogoDarkUrl: 'fld',
      });
      expect(appliedMetadata()).toMatchObject({
        logo: 'l',
        logo_dark: 'ld',
        favicon: 'f',
        footer_logo: 'fl',
        footer_logo_dark: 'fld',
      });
    });

    it('does not overwrite images that were not submitted', async () => {
      await run({ logoUrl: 'new' });
      expect(appliedMetadata({ logo: 'old', favicon: 'keep' })).toMatchObject({
        logo: 'new',
        favicon: 'keep',
      });
    });
  });

  describe('title and description', () => {
    it('updates the site row and stamps the modified date', async () => {
      await run({ title: 'New title', description: 'New description' });
      expect(siteUpdate).toHaveBeenCalledWith({
        where: { id: 'site-a' },
        data: expect.objectContaining({
          title: 'New title',
          description: 'New description',
          date_modified: expect.any(String),
        }),
        select: { id: true },
      });
    });

    it('does not touch metadata when only the title changed', async () => {
      const result = await run({ title: 'New title' });
      expect(result).toEqual({ success: true });
      expect(metadataUpdate).not.toHaveBeenCalled();
    });
  });

  it('tracks the update and flushes analytics on success', async () => {
    await run({ tagline: 'hi' });
    expect(ctx.trackEvent).toHaveBeenCalledTimes(1);
    expect(ctx.analytics.flush).toHaveBeenCalledTimes(1);
  });

  it('does not track anything when validation fails', async () => {
    await run({ colorPrimary: 'nope' });
    expect(ctx.trackEvent).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  describe('activity log', () => {
    const cdn = 'https://cdn.curvenote.com/static/site/a';
    const matter = { family: 'Matter', faces: [{ src: `${cdn}/M.woff2`, weight: 400 }] };
    const license = { files: [{ src: `${cdn}/l.pdf`, name: 'l.pdf' }] };

    it('records a design update naming the fields, by the acting user on the site', async () => {
      await run({ tagline: 'hi', colorPrimary: '#112233' });
      expect(activities()).toEqual([
        ['SITE_DESIGN_UPDATED', { fields: ['tagline', 'color_primary'] }],
      ]);
      const [call] = activityCreate.mock.calls[0];
      expect(call.data.activity_by).toEqual({ connect: { id: 'user-a' } });
      expect(call.data.site).toEqual({ connect: { id: 'site-a' } });
    });

    it('records a fonts update separately from the design, with slots and sources', async () => {
      await run({ fonts: { body: matter }, fontLicense: license });
      expect(activities()).toEqual([
        [
          'SITE_FONTS_UPDATED',
          {
            fonts_changed: true,
            slots: ['body'],
            sources: { body: 'custom' },
            license_changed: true,
            license_files: 1,
            verification_dropped: false,
          },
        ],
      ]);
    });

    it('says when a font change dropped a previous verification', async () => {
      ctx.site.metadata = {
        theme_config: { fonts: { body: matter } },
        font_license: { ...license, verified: true },
      };
      await run({
        fonts: {
          body: { ...matter, faces: [...matter.faces, { src: `${cdn}/B.woff2`, weight: 700 }] },
        },
      });
      expect(activities()[0][1]).toMatchObject({
        verification_dropped: true,
        license_changed: false,
      });
      // and the stored license lost its flag even though only fonts were submitted
      expect(appliedMetadata(ctx.site.metadata as Record<string, unknown>).font_license).toEqual({
        files: license.files,
        verified: undefined,
      });
      ctx.site.metadata = {};
    });
  });
});
