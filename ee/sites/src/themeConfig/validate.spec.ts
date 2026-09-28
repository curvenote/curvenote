// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  FontLicenseSchema,
  FontsSchema,
  RedirectsSchema,
  fontLicenseError,
  fontSlotError,
  fontsError,
  fontsWarnings,
  patternBindings,
  redirectsError,
  redirectsWarnings,
} from './validate.js';
import { explainRedirect } from './explain.js';
import { buildFontCss, googleFontsHref } from './fonts.js';

const cdn = 'https://cdn.curvenote.com/static/site/dhr';

describe('fontsError', () => {
  it('is fine with nothing set, or a complete config', () => {
    expect(fontsError(undefined)).toBeUndefined();
    expect(
      fontsError({
        heading: {
          family: 'Softcore',
          faces: [{ src: `${cdn}/Softcore.woff2`, weight: '100 900' }],
        },
        body: { family: 'Noto Sans', source: 'google', weights: ['100..900'], italic: true },
      }),
    ).toBeUndefined();
  });

  it('requires a name and at least one uploaded file', () => {
    expect(fontsError({ body: { family: '', source: 'custom', faces: [] } })).toBe(
      'Body needs a font name; Body needs at least one font file.',
    );
  });

  it('refuses linked or unsafe font files', () => {
    expect(fontsError({ heading: { family: 'X', faces: [{ src: 'http://x.com/a.woff2' }] } })).toBe(
      'Heading file 1 must be uploaded here, not linked.',
    );
    expect(fontsError({ heading: { family: 'X', faces: [{ src: "https://x/a.woff2')" }] } })).toBe(
      'Heading file 1 must be uploaded here, not linked.',
    );
  });

  it('keeps the fallback a plain list of names', () => {
    expect(
      fontsError({ body: { family: 'X', source: 'stack', fallback: 'serif; color: red' } }),
    ).toBe('Body fallback should be a list of font names, like "Georgia, serif".');
  });

  it('schema accepts the DHR config and rejects a bad display', () => {
    expect(
      FontsSchema.safeParse({
        body: { family: 'Matter', faces: [{ src: `${cdn}/Matter.woff2`, weight: 400 }] },
        small: { family: 'Matter SemiMono', faces: [{ src: `${cdn}/SM.woff2` }], display: 'block' },
      }).success,
    ).toBe(true);
    expect(FontsSchema.safeParse({ body: { family: 'X', display: 'nope' } }).success).toBe(false);
  });
});

describe('fontLicenseError', () => {
  const custom = { body: { family: 'Matter', faces: [{ src: `${cdn}/M.woff2` }] } };
  it('needs a license file once any slot is uploaded', () => {
    expect(fontLicenseError(custom, undefined)).toMatch(/at least one license/);
    expect(fontLicenseError(custom, { files: [] })).toMatch(/at least one license/);
    expect(
      fontLicenseError(custom, { files: [{ src: `${cdn}/l.pdf`, name: 'l.pdf' }] }),
    ).toBeUndefined();
  });
  it('asks nothing of Google or default slots', () => {
    expect(
      fontLicenseError({ body: { family: 'Inter', source: 'google' } }, undefined),
    ).toBeUndefined();
    expect(fontLicenseError(undefined, undefined)).toBeUndefined();
  });
});

describe('FontLicenseSchema', () => {
  it('accepts CDN and loopback uploads, refuses links', () => {
    const ok = (src: string) => FontLicenseSchema.safeParse({ files: [{ src, name: 'l.pdf' }] });
    expect(ok('https://cdn.curvenote.com/static/site/x/l.pdf').success).toBe(true);
    expect(ok('http://127.0.0.1:9000/cdn-pub/static/site/x/l.pdf').success).toBe(true);
    const bad = ok('http://example.org/l.pdf');
    expect(bad.success).toBe(false);
    expect(JSON.stringify(bad.error?.issues)).toContain('uploaded here, not linked');
  });
});

describe('fontsError local development', () => {
  it('accepts a loopback http upload but not a linked http font', () => {
    expect(
      fontsError({ body: { family: 'X', faces: [{ src: 'http://127.0.0.1:9000/pub/x.woff2' }] } }),
    ).toBeUndefined();
    expect(fontsError({ body: { family: 'X', faces: [{ src: 'http://x.com/a.woff2' }] } })).toBe(
      'Body file 1 must be uploaded here, not linked.',
    );
  });
});

describe('fontSlotError', () => {
  it('reports only the named slot', () => {
    const fonts = {
      body: { family: '', source: 'custom' as const, faces: [] },
      heading: { family: 'Ok', source: 'google' as const },
    };
    expect(fontSlotError(fonts, 'body')).toBe(
      'Body needs a font name; Body needs at least one font file.',
    );
    expect(fontSlotError(fonts, 'heading')).toBeUndefined();
    expect(fontSlotError(fonts, 'small')).toBeUndefined();
  });
});

describe('fontsWarnings', () => {
  it('flags a body upload with no italic and a single-weight heading', () => {
    const warnings = fontsWarnings({
      body: { family: 'Matter', faces: [{ src: `${cdn}/M.woff2`, weight: 400 }] },
      heading: { family: 'Softcore', faces: [{ src: `${cdn}/S.woff2`, weight: 300 }] },
    });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/No italic/);
    expect(warnings[1]).toMatch(/One weight/);
  });

  it('is quiet for a variable heading', () => {
    expect(
      fontsWarnings({
        heading: { family: 'S', faces: [{ src: `${cdn}/S.woff2`, weight: '100 900' }] },
      }),
    ).toEqual([]);
  });
});

describe('buildFontCss with a scope', () => {
  it('sets the tokens on the preview container rather than :root', () => {
    const css = buildFontCss(
      { body: { family: 'Matter', fallback: 'sans-serif' } },
      { scope: '.site-preview' },
    );
    expect(css).toContain('.site-preview {');
    expect(css).toContain('--font-body: Matter, sans-serif;');
    expect(css).not.toContain(':root');
  });

  it('honors display on the google link', () => {
    expect(
      googleFontsHref({ body: { family: 'Inter', source: 'google', display: 'block' } }),
    ).toContain('display=block');
  });
});

describe('patternBindings', () => {
  it('lists :path, named params and :splat', () => {
    expect(patternBindings('/about')).toEqual(['path']);
    expect(patternBindings('/tags/:tag')).toEqual(['path', 'tag']);
    expect(patternBindings('/docs/*')).toEqual(['path', 'splat']);
  });
});

describe('redirectsError', () => {
  it('is fine with nothing set, or the DHR config', () => {
    expect(redirectsError(undefined)).toBeUndefined();
    expect(
      redirectsError(
        {
          $landing: 'https://digitalhatereview.com/',
          $info: { to: 'https://digitalhatereview.com/:slug', status: 301 },
          rules: [{ from: '/docs/*', to: 'https://docs.example.org/:splat' }],
        },
        ['www.digitalhatereview.com'],
      ),
    ).toBeUndefined();
  });

  it('requires a site path to redirect from', () => {
    expect(redirectsError({ rules: [{ from: 'about', to: '/info' }] })).toBe(
      'Rule 1: from must be a site path, starting with /.',
    );
    expect(redirectsError({ rules: [{ from: '', to: '/info' }] })).toBe(
      'Rule 1 needs a path to redirect from.',
    );
  });

  it('requires a path or https destination', () => {
    expect(redirectsError({ rules: [{ from: '/a', to: 'example.org' }] })).toBe(
      'Rule 1 must go to a path on this site or a full https:// address.',
    );
    expect(redirectsError({ $landing: 'http://example.org' })).toBe(
      'Landing page should use https://.',
    );
  });

  it('only allows params the pattern binds', () => {
    expect(redirectsError({ rules: [{ from: '/docs/*', to: '/new/:tag' }] })).toBe(
      'Rule 1 uses :tag, which the pattern does not provide (available: :path, :splat).',
    );
    expect(redirectsError({ $info: '/pages/:slug' })).toBeUndefined();
    expect(redirectsError({ $landing: '/pages/:slug' })).toBe(
      'Landing page uses :slug, which the pattern does not provide (available: :path).',
    );
  });

  it('catches a rule that sends a request back to itself on one of the site hostnames', () => {
    expect(
      redirectsError({ rules: [{ from: '/about', to: 'https://scipy.curve.space/about' }] }, [
        'scipy.curve.space',
      ]),
    ).toBe('Rule 1 would redirect to itself on scipy.curve.space.');
  });

  it('schema accepts bare strings and specs, rejects other statuses', () => {
    expect(RedirectsSchema.safeParse({ $landing: 'https://x.org/', rules: [] }).success).toBe(true);
    expect(RedirectsSchema.safeParse({ $info: { to: '/x', status: 303 } }).success).toBe(false);
  });

  it('refuses the method-preserving statuses the theme would otherwise accept', () => {
    expect(
      RedirectsSchema.safeParse({ rules: [{ from: '/a', to: '/b', status: 307 }] }).success,
    ).toBe(false);
    expect(RedirectsSchema.safeParse({ $landing: { to: '/b', status: 308 } }).success).toBe(false);
    expect(redirectsError({ rules: [{ from: '/a', to: '/b', status: 307 }] })).toBe(
      'Rule 1 uses status 307; only temporary (302) and permanent (301) are supported.',
    );
    expect(redirectsError({ $notFound: { to: '/', status: 308 } })).toBe(
      'Not found uses status 308; only temporary (302) and permanent (301) are supported.',
    );
  });
});

describe('redirectsWarnings', () => {
  it('flags unreachable duplicates and reserved-path patterns', () => {
    const warnings = redirectsWarnings({
      rules: [
        { from: '/about', to: '/a' },
        { from: '/about', to: '/b' },
        { from: '/api/*', to: '/c' },
      ],
    });
    expect(warnings[0]).toBe('Rule 2 is never reached — rule 1 already handles /about.');
    expect(warnings[1]).toMatch(/^Rule 3: \/api\/\* is a theme path/);
  });
});

describe('explainRedirect', () => {
  const config = {
    $landing: 'https://digitalhatereview.com/',
    $info: { to: 'https://digitalhatereview.com/:slug', status: 301 as const },
    $notFound: '/',
    rules: [{ from: '/docs/*', to: 'https://docs.example.org/:splat', status: 301 as const }],
  };
  const at = (path: string, notFound = false) =>
    explainRedirect(new URL(path, 'https://www.digitalhatereview.com'), config, { notFound });

  it('names the rule that matched', () => {
    expect(at('/docs/getting-started')).toMatchObject({
      kind: 'rule',
      index: 0,
      resolution: { to: 'https://docs.example.org/getting-started', status: 301 },
    });
  });

  it('falls through to the groups in the matcher order', () => {
    expect(at('/')).toMatchObject({ kind: '$landing', resolution: { status: 302 } });
    expect(at('/about')).toMatchObject({
      kind: '$info',
      resolution: { to: 'https://digitalhatereview.com/about' },
    });
    expect(at('/a/b', true)).toMatchObject({ kind: '$notFound' });
    expect(at('/articles/x')).toEqual({ kind: 'none', reserved: false });
  });

  it('leaves theme paths alone', () => {
    expect(at('/api/health')).toEqual({ kind: 'none', reserved: true });
    expect(at('/sitemap.xml', true)).toEqual({ kind: 'none', reserved: true });
  });
});
