// Vendored from next-theme: packages/common/src/types/design.ts (fonts) and
// packages/common/src/types/redirects.ts. next-theme is the source of truth for these shapes —
// the admin's own `@curvenote/common` is a different package and is not kept in step. Copy, do
// not edit; re-copy when next-theme changes.
import type { JournalThemeConfig } from '@curvenote/common';

// ---- fonts (packages/common/src/types/design.ts) --------------------------------------------

export type FontFace = {
  /** Absolute URL to the file; prefer `.woff2` */
  src: string;
  /** `400`, or a range like `"100 900"` for a variable font */
  weight?: number | `${number} ${number}`;
  style?: 'normal' | 'italic';
  /**
   * Metric overrides applied to the *fallback* while the webfont loads, to stop the page
   * reflowing when it swaps in. Generated from the font's own metrics.
   */
  sizeAdjust?: string;
  ascentOverride?: string;
  descentOverride?: string;
  lineGapOverride?: string;
};

export type FontSlot = {
  /** CSS family name, or the Google Fonts family name */
  family: string;
  /**
   * `custom` self-hosts the files in `faces`; `google` loads from Google Fonts; `stack`
   * uses `family` as a plain CSS font stack with nothing to download. Inferred from
   * whether `faces` is set when omitted.
   */
  source?: 'custom' | 'google' | 'stack';
  /** `source: 'custom'` — the files to load */
  faces?: FontFace[];
  /** `source: 'google'` — weights to request; `'100..900'` asks for a variable font's whole axis */
  weights?: (number | `${number}..${number}`)[];
  /** `source: 'google'` — also request the italic axis */
  italic?: boolean;
  /** Appended after `family` in the CSS stack */
  fallback?: string;
  /** `font-display`, defaults to `swap` */
  display?: 'swap' | 'block' | 'optional' | 'fallback';
};

export type ThemeFontsConfig = {
  /** h1–h6 and the title block */
  heading?: FontSlot;
  /** Body text; also the default for `heading` and `small` when they are not set */
  body?: FontSlot;
  /** Footnotes, captions, backmatter, outline */
  small?: FontSlot;
  /** Code blocks and inline code */
  mono?: FontSlot;
};

// ---- redirects (packages/common/src/types/redirects.ts) -------------------------------------

export type RedirectStatus = 301 | 302 | 307 | 308;

export type RedirectSpec = {
  /**
   * Site-relative path or absolute http(s) URL. May reference `:params` bound by the matching
   * pattern, plus `:path` (the request pathname without its leading slash).
   */
  to: string;
  /** Defaults to 302 — `$info` and `$notFound` targets can legitimately gain content later. */
  status?: RedirectStatus;
  /** Carry the incoming query string onto the destination. Defaults to `true`. */
  forward_query?: boolean;
};

export type RedirectTarget = string | RedirectSpec;

export type RedirectRule = RedirectSpec & {
  /** `/about`, `/tags/:tag`, or `/docs/*` (which also matches `/docs`, binding `:splat`). */
  from: string;
};

/** Redirects keyed by reserved page groups, plus an ordered explicit rule list. */
export type ThemeRedirectsConfig = {
  /** Ordered, first match wins. Evaluated before the reserved keys below. */
  rules?: RedirectRule[];
  /** The site index (`/`). Mirrors `design.$landing`. */
  $landing?: RedirectTarget;
  /** Every single-segment info page (`/:info`). Binds `:slug`. */
  $info?: RedirectTarget;
  /** Anything that would otherwise 404 — an unmatched route or missing content. */
  $notFound?: RedirectTarget;
};

// ---- site theme config -----------------------------------------------------------------------

/**
 * `site.metadata.theme_config` as the theme reads it. next-theme calls this `SiteThemeConfig`
 * (its `JournalThemeConfig` minus two never-read keys, plus `fonts`); `redirects` was added by the
 * `journal-redirects` change. Here it is the admin's `JournalThemeConfig` widened the same way.
 */
export type SiteThemeConfig = Omit<JournalThemeConfig, 'fonts' | 'styles'> & {
  fonts?: ThemeFontsConfig;
  redirects?: ThemeRedirectsConfig;
};

// ---- admin-only: font license records ---------------------------------------------------------

/**
 * Receipts and license terms for self-hosted fonts. Lives at `site.metadata.font_license`,
 * beside `theme_config`, and is never read by the theme — it is the paper trail for what the
 * site is allowed to serve. `verified` is set by hand once someone has read the files.
 */
export type FontLicenseFile = {
  /** CDN URL of the uploaded file */
  src: string;
  /** Original file name, for display and download */
  name: string;
};

export type FontLicense = {
  files?: FontLicenseFile[];
  verified?: boolean;
};
