import {
  isReservedPath,
  matchPattern,
  resolveTarget,
  type RedirectResolution,
} from './redirects.js';
import type { RedirectRule, ThemeRedirectsConfig } from './types.js';

/** Where a match came from, for the tester to name it. */
export type RedirectExplanation =
  | { kind: 'rule'; index: number; rule: RedirectRule; resolution: RedirectResolution }
  | { kind: '$landing' | '$info' | '$notFound'; resolution: RedirectResolution }
  | { kind: 'none'; reserved: boolean };

function normalizePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  const withoutTrailing = withLeading.replace(/\/+$/, '');
  return withoutTrailing === '' ? '/' : withoutTrailing;
}

const SIDECAR_EXTENSION = /\.(?:json|inv|pdf|omex|xml|meca|zip)$/i;

/**
 * The same walk `matchRedirect` / `matchNotFoundRedirect` do, but reporting which entry matched.
 * `notFound` says whether the path would otherwise 404 (so `$notFound` applies) or render (so
 * `$landing` / `$info` do). Mirrors the matcher's order: rules, then reserved-path guard, then groups.
 */
export function explainRedirect(
  url: URL,
  config: ThemeRedirectsConfig | undefined,
  opts: { notFound: boolean },
): RedirectExplanation {
  const pathname = normalizePath(url.pathname);
  const reserved = isReservedPath(pathname);
  if (!config) return { kind: 'none', reserved };

  if (Array.isArray(config.rules)) {
    for (let index = 0; index < config.rules.length; index++) {
      const rule = config.rules[index];
      if (!rule || typeof rule.from !== 'string') continue;
      // A reserved path may only be redirected by a rule that names it literally
      if (reserved && /[:*]/.test(rule.from)) continue;
      const bindings = matchPattern(rule.from, pathname);
      if (!bindings) continue;
      const resolution = resolveTarget(rule, { ...bindings, path: pathname.slice(1) }, url);
      if (resolution) return { kind: 'rule', index, rule, resolution };
    }
  }
  if (reserved) return { kind: 'none', reserved };

  if (opts.notFound) {
    const resolution = resolveTarget(config.$notFound, { path: pathname.slice(1) }, url);
    return resolution ? { kind: '$notFound', resolution } : { kind: 'none', reserved };
  }
  if (pathname === '/') {
    const resolution = resolveTarget(config.$landing, { path: '' }, url);
    return resolution ? { kind: '$landing', resolution } : { kind: 'none', reserved };
  }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    const slug = segments[0].replace(SIDECAR_EXTENSION, '');
    if (slug) {
      const resolution = resolveTarget(config.$info, { slug, path: pathname.slice(1) }, url);
      return resolution ? { kind: '$info', resolution } : { kind: 'none', reserved };
    }
  }
  return { kind: 'none', reserved };
}
