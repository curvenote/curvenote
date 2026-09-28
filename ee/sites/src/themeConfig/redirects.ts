// Vendored from next-theme: packages/common/src/redirects.ts — the matcher the theme runs on
// every request. Kept verbatim (only the import path differs) so what the admin's tester and
// validation say is exactly what the site will do. Re-copy when next-theme changes it.
import type {
  RedirectRule,
  RedirectSpec,
  RedirectStatus,
  RedirectTarget,
  ThemeRedirectsConfig,
} from './types.js';

export const DEFAULT_REDIRECT_STATUS: RedirectStatus = 302;

const VALID_STATUSES: RedirectStatus[] = [301, 302, 307, 308];

/**
 * Paths the theme owns and must keep serving. `$info` and `$notFound` never sweep these up; only a
 * `rules` entry that names one literally (no `:param` or `*`) can redirect it. `/login` matters
 * most — `requireUser()` redirects there and it has no route of its own, so it falls through to
 * `/:info`.
 */
export const RESERVED_PATHS = [
  '/api/*',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap_style.xsl',
  '/objects.inv',
  '/favicon.ico',
  '/.well-known/*',
  '/previews/*',
  '/login',
];

/** Extensions the `$info` route strips before loading a page; `:slug` should match what it loads. */
const SIDECAR_EXTENSION = /\.(?:json|inv|pdf|omex|xml|meca|zip)$/i;

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

export type RedirectResolution = { to: string; status: RedirectStatus };

const warned = new Set<string>();

/** A bad `theme_config` should never take a site down, so misconfiguration warns once and is skipped. */
function warn(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[redirects] ${message}`);
}

function normalizePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  const withoutTrailing = withLeading.replace(/\/+$/, '');
  return withoutTrailing === '' ? '/' : withoutTrailing;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type CompiledPattern = { regex: RegExp; names: string[] };

const patternCache = new Map<string, CompiledPattern | null>();

function compilePattern(from: string): CompiledPattern | null {
  const cached = patternCache.get(from);
  if (cached !== undefined) return cached;
  const compiled = compile(from);
  patternCache.set(from, compiled);
  return compiled;
}

function compile(from: string): CompiledPattern | null {
  if (typeof from !== 'string' || from.trim() === '') {
    warn(`ignoring rule with an empty 'from'`);
    return null;
  }
  const segments = normalizePath(from.trim()).split('/').slice(1);
  const names: string[] = [];
  let source = '';
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment === '*') {
      if (i !== segments.length - 1) {
        warn(`ignoring '${from}': '*' is only allowed as the final segment`);
        return null;
      }
      names.push('splat');
      // Optional so `/docs/*` also matches `/docs` itself.
      source += '(?:/(.*))?';
      continue;
    }
    if (segment.startsWith(':')) {
      const name = segment.slice(1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        warn(`ignoring '${from}': ':${name}' is not a valid parameter name`);
        return null;
      }
      names.push(name);
      source += '/([^/]+)';
      continue;
    }
    source += `/${escapeRegExp(segment)}`;
  }
  try {
    return { regex: new RegExp(`^${source || '/'}$`, 'i'), names };
  } catch {
    warn(`ignoring '${from}': could not be compiled to a pattern`);
    return null;
  }
}

/** Matches `pathname` against a `from` pattern, returning its parameter bindings. */
export function matchPattern(from: string, pathname: string): Record<string, string> | null {
  const compiled = compilePattern(from);
  if (!compiled) return null;
  const match = compiled.regex.exec(normalizePath(pathname));
  if (!match) return null;
  const bindings: Record<string, string> = {};
  compiled.names.forEach((name, index) => {
    bindings[name] = match[index + 1] ?? '';
  });
  return bindings;
}

export function isReservedPath(pathname: string): boolean {
  return RESERVED_PATHS.some((reserved) => matchPattern(reserved, pathname) !== null);
}

function substitute(to: string, bindings: Record<string, string>): string {
  // `:name` requires a leading letter, so `https://` and `:8080` are left alone.
  return to.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (token, name: string) =>
    name in bindings ? bindings[name] : token,
  );
}

function readStatus(status: RedirectSpec['status'], to: string): RedirectStatus {
  if (status === undefined) return DEFAULT_REDIRECT_STATUS;
  if (VALID_STATUSES.includes(status)) return status;
  warn(`ignoring status '${status}' on '${to}': expected one of ${VALID_STATUSES.join(', ')}`);
  return DEFAULT_REDIRECT_STATUS;
}

/**
 * Substitutes `bindings` into a target and resolves it against the incoming URL. Returns null when
 * the target is malformed, is not http(s), or would redirect the request back to itself.
 */
export function resolveTarget(
  target: RedirectTarget | undefined,
  bindings: Record<string, string>,
  url: URL,
): RedirectResolution | null {
  const spec: RedirectSpec | undefined = typeof target === 'string' ? { to: target } : target;
  if (!spec || typeof spec.to !== 'string' || spec.to.trim() === '') {
    if (spec) warn(`ignoring redirect with a missing or non-string 'to'`);
    return null;
  }

  const substituted = substitute(spec.to.trim(), bindings);

  let destination: URL;
  try {
    destination = new URL(substituted, url);
  } catch {
    warn(`ignoring '${spec.to}': could not be parsed as a URL`);
    return null;
  }

  if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
    warn(`ignoring '${spec.to}': only http and https destinations are allowed`);
    return null;
  }

  if (spec.forward_query !== false) {
    url.searchParams.forEach((value, key) => {
      destination.searchParams.append(key, value);
    });
  }

  // Cheapest defence against a redirect loop.
  if (destination.origin === url.origin && destination.pathname === normalizePath(url.pathname)) {
    return null;
  }

  return {
    to: ABSOLUTE_URL.test(substituted)
      ? destination.href
      : `${destination.pathname}${destination.search}${destination.hash}`,
    status: readStatus(spec.status, spec.to),
  };
}

function matchRules(url: URL, rules: RedirectRule[] | undefined): RedirectResolution | null {
  if (!Array.isArray(rules)) return null;
  const pathname = normalizePath(url.pathname);
  const reserved = isReservedPath(pathname);
  for (const rule of rules) {
    if (!rule || typeof rule.from !== 'string') {
      warn(`ignoring rule without a 'from'`);
      continue;
    }
    const compiled = compilePattern(rule.from);
    if (!compiled) continue;
    // A reserved path may only be redirected by a rule that names it literally.
    if (reserved && compiled.names.length > 0) continue;
    const bindings = matchPattern(rule.from, pathname);
    if (!bindings) continue;
    const resolved = resolveTarget(rule, { ...bindings, path: pathname.slice(1) }, url);
    // Skip rather than stop, so one broken rule cannot shadow a valid one behind it.
    if (resolved) return resolved;
  }
  return null;
}

/** The single-segment slug an `/:info` request would load, or null if the path is not one. */
function infoSlug(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return null;
  return segments[0].replace(SIDECAR_EXTENSION, '') || null;
}

/**
 * Resolves `rules`, then `$landing` / `$info`, for a request that would otherwise be served
 * normally. Returns null when the journal has configured nothing for this path.
 */
export function matchRedirect(
  url: URL,
  config: ThemeRedirectsConfig | undefined,
): RedirectResolution | null {
  if (!config) return null;
  const fromRules = matchRules(url, config.rules);
  if (fromRules) return fromRules;

  const pathname = normalizePath(url.pathname);
  if (isReservedPath(pathname)) return null;

  if (pathname === '/') return resolveTarget(config.$landing, { path: '' }, url);

  const slug = infoSlug(pathname);
  if (slug) return resolveTarget(config.$info, { slug, path: pathname.slice(1) }, url);

  return null;
}

/**
 * Resolves `rules`, then `$notFound`, for a request already heading to an error page — either an
 * unmatched route or a matched route whose content is missing.
 */
export function matchNotFoundRedirect(
  url: URL,
  config: ThemeRedirectsConfig | undefined,
): RedirectResolution | null {
  if (!config) return null;
  const fromRules = matchRules(url, config.rules);
  if (fromRules) return fromRules;

  const pathname = normalizePath(url.pathname);
  if (isReservedPath(pathname)) return null;

  return resolveTarget(config.$notFound, { path: pathname.slice(1) }, url);
}
