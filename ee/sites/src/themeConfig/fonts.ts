// Vendored from next-theme: packages/ui/src/lib/fonts.ts — the generator the theme uses to turn
// `theme_config.fonts` into `@font-face` rules, token assignments and the Google Fonts link. The
// one local addition is `scope`, so the admin preview can apply a site's fonts to itself without
// restyling the admin app. Re-copy the rest when next-theme changes it.
import type { FontFace, FontSlot, ThemeFontsConfig } from './types.js';

/** Slots in the order they cascade: `heading` and `small` fall back to `body`. */
export const FONT_SLOTS = ['body', 'heading', 'small', 'mono'] as const;
export type FontSlotName = (typeof FONT_SLOTS)[number];

/** Font files are same-origin or CDN URLs; refuse anything that could break out of `url()`. */
export function isSafeFontUrl(src: string): boolean {
  if (/["'()\\]|[\s]/.test(src)) return false;
  return /^https:\/\//.test(src) || /^\//.test(src);
}

/** A family name may contain spaces, so quote it unless it already is. */
function quoteFamily(family: string): string {
  const trimmed = family.trim();
  if (/^["']/.test(trimmed)) return trimmed;
  return /[^a-zA-Z0-9-]/.test(trimmed) ? `'${trimmed.replace(/'/g, '')}'` : trimmed;
}

/** `family, fallback` — what the `--font-*` token is set to. */
export function fontStack(slot: FontSlot): string {
  const fallback = slot.fallback?.trim();
  return fallback ? `${quoteFamily(slot.family)}, ${fallback}` : quoteFamily(slot.family);
}

function faceRule(family: string, face: FontFace, display: string): string | undefined {
  if (!isSafeFontUrl(face.src)) return undefined;
  const format = face.src.endsWith('.woff2')
    ? 'woff2'
    : face.src.endsWith('.woff')
      ? 'woff'
      : face.src.endsWith('.otf')
        ? 'opentype'
        : face.src.endsWith('.ttf')
          ? 'truetype'
          : undefined;
  const lines = [
    `  font-family: ${quoteFamily(family)};`,
    `  src: url(${face.src})${format ? ` format('${format}')` : ''};`,
    `  font-weight: ${face.weight ?? 400};`,
    `  font-style: ${face.style ?? 'normal'};`,
    `  font-display: ${display};`,
  ];
  if (face.sizeAdjust) lines.push(`  size-adjust: ${face.sizeAdjust};`);
  if (face.ascentOverride) lines.push(`  ascent-override: ${face.ascentOverride};`);
  if (face.descentOverride) lines.push(`  descent-override: ${face.descentOverride};`);
  if (face.lineGapOverride) lines.push(`  line-gap-override: ${face.lineGapOverride};`);
  return `@font-face {\n${lines.join('\n')}\n}`;
}

/**
 * Google Fonts stylesheet URL for the slots that ask for it, or `undefined` when none do.
 * One request covers every Google-sourced family.
 */
export function googleFontsHref(fonts?: ThemeFontsConfig): string | undefined {
  if (!fonts) return undefined;
  const google = FONT_SLOTS.map((name) => fonts[name]).filter(
    (slot): slot is FontSlot => slot?.source === 'google',
  );
  const display = (fonts.body?.source === 'google' ? fonts.body : google[0])?.display ?? 'swap';
  const families = google.map((slot) => {
    const weights = [...new Set(slot.weights ?? [400, 700])].sort(
      (a, b) => parseInt(String(a), 10) - parseInt(String(b), 10),
    );
    const axis = slot.italic
      ? `:ital,wght@${weights.map((w) => `0,${w}`).join(';')};${weights.map((w) => `1,${w}`).join(';')}`
      : `:wght@${weights.join(';')}`;
    return `family=${slot.family.trim().replace(/\s+/g, '+')}${axis}`;
  });
  const unique = [...new Set(families)];
  return unique.length
    ? `https://fonts.googleapis.com/css2?${unique.join('&')}&display=${display}`
    : undefined;
}

/**
 * `@font-face` rules plus token assignments for a site's font config. Returns an empty string
 * when nothing is configured. `scope` is the selector the tokens are set on — `:root` in the
 * theme, the preview container here.
 */
export function buildFontCss(fonts?: ThemeFontsConfig, opts?: { scope?: string }): string {
  if (!fonts) return '';
  const scope = opts?.scope ?? ':root';
  const faces: string[] = [];
  const tokens: string[] = [];
  for (const name of FONT_SLOTS) {
    const slot = fonts[name];
    if (!slot?.family) continue;
    const display = slot.display ?? 'swap';
    if (slot.source !== 'stack') {
      for (const face of slot.faces ?? []) {
        const rule = faceRule(slot.family, face, display);
        if (rule) faces.push(rule);
      }
    }
    tokens.push(`  --font-${name}: ${fontStack(slot)};`);
  }
  if (!faces.length && !tokens.length) return '';
  const root = tokens.length ? `${scope} {\n${tokens.join('\n')}\n}` : '';
  return [...faces, root].filter(Boolean).join('\n');
}

/** Infer the source the way the theme does when `source` is omitted. */
export function fontSlotSource(
  slot: FontSlot | undefined,
): 'google' | 'custom' | 'stack' | undefined {
  if (!slot) return undefined;
  if (slot.source) return slot.source;
  return slot.faces?.length ? 'custom' : 'stack';
}
