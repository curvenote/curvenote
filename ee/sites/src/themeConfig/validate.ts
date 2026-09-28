import { z } from 'zod';
import { FONT_SLOTS, fontSlotSource, isSafeFontUrl } from './fonts.js';
import { RESERVED_PATHS, matchPattern, matchRedirect, resolveTarget } from './redirects.js';
import { summarizeIssues } from './summarizeIssues.js';
import type {
  FontLicense,
  RedirectTarget,
  ThemeFontsConfig,
  ThemeRedirectsConfig,
} from './types.js';

/*
 * One set of rules for both sides of the form. The `*Error` helpers produce the sentence the
 * client shows beside the section and the server returns as its 400; the zod schemas gate the
 * shape on the server. Anything the theme would silently drop (see `isSafeFontUrl`,
 * `resolveTarget`) is rejected here with a reason instead.
 */

// ---- fonts -------------------------------------------------------------------------------------

export const SLOT_LABELS: Record<(typeof FONT_SLOTS)[number], string> = {
  body: 'Body',
  heading: 'Heading',
  small: 'Small text',
  mono: 'Code',
};

const WEIGHT_RANGE = /^\d{3}(?:\.\.\d{3})?$/;

const FontFaceSchema = z.object({
  src: z.string().min(1),
  weight: z
    .union([z.number().int().min(1).max(1000), z.string().regex(/^\d{1,4} \d{1,4}$/)])
    .optional(),
  style: z.enum(['normal', 'italic']).optional(),
  sizeAdjust: z.string().optional(),
  ascentOverride: z.string().optional(),
  descentOverride: z.string().optional(),
  lineGapOverride: z.string().optional(),
});

const FontSlotSchema = z.object({
  family: z.string().min(1),
  source: z.enum(['custom', 'google', 'stack']).optional(),
  faces: z.array(FontFaceSchema).optional(),
  weights: z.array(z.union([z.number().int(), z.string().regex(WEIGHT_RANGE)])).optional(),
  italic: z.boolean().optional(),
  fallback: z.string().optional(),
  display: z.enum(['swap', 'block', 'optional', 'fallback']).optional(),
});

export const FontsSchema = z.object({
  body: FontSlotSchema.optional(),
  heading: FontSlotSchema.optional(),
  small: FontSlotSchema.optional(),
  mono: FontSlotSchema.optional(),
});

/** An uploaded file's URL: the CDN over https, or the local bucket over loopback http in dev. */
const UPLOADED_URL = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)/;

export const FontLicenseSchema = z.object({
  files: z
    .array(
      z.object({
        src: z.string().regex(UPLOADED_URL, 'License files must be uploaded here, not linked'),
        name: z.string().min(1),
      }),
    )
    .optional(),
  verified: z.boolean().optional(),
});

/** Characters that would let a fallback stack escape the declaration it is pasted into. */
const UNSAFE_FALLBACK = /[;{}]|url\(/i;

/** What is wrong with the fonts, phrased for the reader; undefined when fine. */
export function fontsError(fonts: ThemeFontsConfig | undefined): string | undefined {
  if (!fonts) return undefined;
  const issues: string[] = [];
  for (const name of FONT_SLOTS) {
    const slot = fonts[name];
    if (!slot) continue;
    const label = SLOT_LABELS[name];
    if (!slot.family?.trim()) issues.push(`${label} needs a font name`);
    const source = fontSlotSource(slot);
    if (source === 'custom') {
      if (!slot.faces?.length) issues.push(`${label} needs at least one font file`);
      slot.faces?.forEach((face, index) => {
        if (!face.src?.trim()) issues.push(`${label} file ${index + 1} is missing`);
        else if (!isUploadedFontUrl(face.src))
          issues.push(`${label} file ${index + 1} must be uploaded here, not linked`);
      });
    }
    if (source === 'google' && slot.weights && slot.weights.length === 0)
      issues.push(`${label} needs at least one weight`);
    if (slot.fallback && UNSAFE_FALLBACK.test(slot.fallback))
      issues.push(`${label} fallback should be a list of font names, like "Georgia, serif"`);
  }
  return summarizeIssues(issues);
}

/**
 * An uploaded file is an `https://` CDN URL. Local development serves the bucket over plain
 * http on a loopback address, which the theme would refuse in production but is the only
 * way to try the feature locally.
 */
function isUploadedFontUrl(src: string): boolean {
  if (!UPLOADED_URL.test(src)) return false;
  return /^https:\/\//.test(src) ? isSafeFontUrl(src) : !/["'()\\\s]/.test(src);
}

/**
 * Self-hosted fonts need their paperwork: at least one license or receipt on file before the
 * fonts can be saved. Google Fonts and the defaults need nothing.
 */
export function fontLicenseError(
  fonts: ThemeFontsConfig | undefined,
  license: FontLicense | undefined,
): string | undefined {
  const uploaded = FONT_SLOTS.filter((name) => fontSlotSource(fonts?.[name]) === 'custom');
  if (!uploaded.length) return undefined;
  if (license?.files?.length) return undefined;
  return 'Upload at least one license or receipt for the fonts you have uploaded.';
}

/** The problems with one slot alone, for a per-row indicator. */
export function fontSlotError(
  fonts: ThemeFontsConfig | undefined,
  name: (typeof FONT_SLOTS)[number],
): string | undefined {
  const slot = fonts?.[name];
  return slot ? fontsError({ [name]: slot }) : undefined;
}

/**
 * Advisory only — nothing here stops a save. Things a site admin will want to know before
 * shipping a font: missing italics get synthesized, a single-weight heading gets faux-bold.
 */
export function fontsWarnings(fonts: ThemeFontsConfig | undefined): string[] {
  if (!fonts) return [];
  const warnings: string[] = [];
  const body = fonts.body;
  if (body && fontSlotSource(body) === 'custom' && body.faces?.length) {
    if (!body.faces.some((face) => face.style === 'italic'))
      warnings.push(
        'No italic uploaded for Body — browsers will slant the regular face for emphasis. Ask the foundry for an italic if this matters.',
      );
  }
  const heading = fonts.heading;
  if (heading && fontSlotSource(heading) === 'custom' && heading.faces?.length === 1) {
    const weight = heading.faces[0].weight;
    if (typeof weight !== 'string')
      warnings.push(
        'One weight uploaded for Heading. Headings render at several weights; choose Variable if this file covers them, or upload more weights.',
      );
  }
  return warnings;
}

// ---- redirects ---------------------------------------------------------------------------------

/**
 * The theme also honors 307/308, but the admin only offers temporary/permanent: we never want
 * a redirect to carry a form post across sites, so the method-preserving codes are refused
 * here on the server too, whatever the client sent.
 */
export const ADMIN_REDIRECT_STATUSES = [301, 302] as const;

const RedirectSpecSchema = z.object({
  to: z.string().min(1),
  status: z.union([z.literal(301), z.literal(302)]).optional(),
  forward_query: z.boolean().optional(),
});
const RedirectTargetSchema = z.union([z.string().min(1), RedirectSpecSchema]);

export const RedirectsSchema = z.object({
  rules: z.array(RedirectSpecSchema.extend({ from: z.string().min(1) })).optional(),
  $landing: RedirectTargetSchema.optional(),
  $info: RedirectTargetSchema.optional(),
  $notFound: RedirectTargetSchema.optional(),
});

export const GROUP_LABELS = {
  $landing: 'Landing page',
  $info: 'Info pages',
  $notFound: 'Not found',
} as const;
export type RedirectGroup = keyof typeof GROUP_LABELS;

const PARAM = /:([A-Za-z_][A-Za-z0-9_]*)/g;

/** The `:name` bindings a `from` pattern makes available to its `to`. */
export function patternBindings(from: string): string[] {
  const names = ['path'];
  for (const match of from.matchAll(PARAM)) names.push(match[1]);
  if (/\*/.test(from)) names.push('splat');
  return names;
}

function targetTo(target: RedirectTarget | undefined): string | undefined {
  if (target === undefined) return undefined;
  return typeof target === 'string' ? target : target.to;
}

function statusProblem(status: number | undefined): string | undefined {
  if (status === undefined) return undefined;
  if ((ADMIN_REDIRECT_STATUSES as readonly number[]).includes(status)) return undefined;
  return `uses status ${status}; only temporary (302) and permanent (301) are supported`;
}

function toProblem(to: string, bindings: string[]): string | undefined {
  const trimmed = to.trim();
  if (!trimmed) return 'needs a destination';
  if (!trimmed.startsWith('/') && !/^https?:\/\//i.test(trimmed))
    return 'must go to a path on this site or a full https:// address';
  if (/^http:\/\//i.test(trimmed)) return 'should use https://';
  const unknown = [...trimmed.matchAll(PARAM)]
    .map((m) => m[1])
    .filter((name) => !bindings.includes(name));
  if (unknown.length) {
    const available = bindings.map((b) => `:${b}`).join(', ');
    return `uses :${unknown[0]}, which the pattern does not provide (available: ${available})`;
  }
  return undefined;
}

/**
 * What is wrong with the redirects, phrased for the reader; undefined when fine.
 * `hostnames` are the site's domains, used to catch a rule that sends a request to itself.
 */
export function redirectsError(
  redirects: ThemeRedirectsConfig | undefined,
  hostnames: string[] = [],
): string | undefined {
  if (!redirects) return undefined;
  const issues: string[] = [];

  (redirects.rules ?? []).forEach((rule, index) => {
    const where = `Rule ${index + 1}`;
    const from = rule?.from?.trim() ?? '';
    if (!from) issues.push(`${where} needs a path to redirect from`);
    else if (!from.startsWith('/'))
      issues.push(`${where}: from must be a site path, starting with /`);
    const problem = toProblem(rule?.to ?? '', patternBindings(from));
    if (problem) issues.push(`${where} ${problem}`);
    const status = statusProblem(rule?.status);
    if (status) issues.push(`${where} ${status}`);
  });

  const groupBindings: Record<RedirectGroup, string[]> = {
    $landing: ['path'],
    $info: ['path', 'slug'],
    $notFound: ['path'],
  };
  (Object.keys(GROUP_LABELS) as RedirectGroup[]).forEach((group) => {
    const to = targetTo(redirects[group]);
    if (to === undefined) return;
    const problem = toProblem(to, groupBindings[group]);
    if (problem) issues.push(`${GROUP_LABELS[group]} ${problem}`);
    const target = redirects[group];
    const status = statusProblem(typeof target === 'string' ? undefined : target?.status);
    if (status) issues.push(`${GROUP_LABELS[group]} ${status}`);
  });

  // Would any literal rule send a request straight back to itself on one of our hostnames?
  if (issues.length === 0) {
    (redirects.rules ?? []).forEach((rule, index) => {
      if (/[:*]/.test(rule.from)) return;
      for (const host of hostnames) {
        const url = new URL(rule.from, `https://${host}`);
        const resolved = resolveTarget(rule, { path: rule.from.slice(1) }, url);
        // `resolveTarget` returns null for a self-redirect; a literal rule that resolves to
        // nothing can only be that.
        if (resolved === null && matchPattern(rule.from, url.pathname)) {
          issues.push(`Rule ${index + 1} would redirect to itself on ${host}`);
          break;
        }
      }
    });
  }

  return summarizeIssues(issues);
}

/** Advisory only: unreachable rules and reserved paths that will not behave as typed. */
export function redirectsWarnings(redirects: ThemeRedirectsConfig | undefined): string[] {
  if (!redirects) return [];
  const warnings: string[] = [];
  const rules = redirects.rules ?? [];
  rules.forEach((rule, index) => {
    const from = rule?.from?.trim();
    if (!from) return;
    const earlier = rules.findIndex((other, i) => i < index && other?.from?.trim() === from);
    if (earlier !== -1)
      warnings.push(
        `Rule ${index + 1} is never reached — rule ${earlier + 1} already handles ${from}.`,
      );
    const reserved = RESERVED_PATHS.find((path) => matchPattern(path, from));
    if (reserved && /[:*]/.test(from))
      warnings.push(
        `Rule ${index + 1}: ${reserved} is a theme path. Patterns do not match it; only a rule naming the exact path applies.`,
      );
  });
  return warnings;
}

/** Sanity check used by the tester: does the config, as typed, redirect the site root? */
export function redirectsLandingResolution(
  redirects: ThemeRedirectsConfig | undefined,
  host: string,
) {
  return matchRedirect(new URL('/', `https://${host}`), redirects);
}
