/**
 * Options for building a Vercel Cache-Control header. All values are in seconds.
 * See: https://vercel.com/docs/caching/cache-control-headers
 */
export type VercelCacheOptionsPublic = {
  /** Browser cache TTL. Sent to the client. */
  maxAge: number;
  /** CDN cache TTL. Consumed by Vercel's edge; not forwarded to the client. */
  sMaxAge: number;
  /**
   * After the response is stale, how long the CDN may serve it while revalidating in the background.
   * Use 0 to omit. Typically less than sMaxAge.
   * See: https://vercel.com/docs/caching/cache-control-headers#stale-while-revalidate
   */
  staleWhileRevalidate?: number;
  /**
   * How long the CDN may serve a stale response when the origin returns an error (e.g. 5xx).
   * Use 0 to omit.
   * See: https://vercel.com/docs/caching/cache-control-headers#stale-if-error
   */
  staleIfError?: number;
};

/** Use for auth-gated responses. CDN must not cache; browser may cache for the same user. */
export type VercelCacheOptionsPrivate = {
  private: true;
  maxAge: number;
};

export type VercelCacheOptions = VercelCacheOptionsPublic | VercelCacheOptionsPrivate;

/**
 * Which response header to set with the cache directive value.
 * - Cache-Control: web standard; Vercel uses it for edge cache and forwards to the client.
 * - CDN-Cache-Control: used by Vercel and other CDNs; overrides Cache-Control for CDN behavior.
 * - Vercel-CDN-Cache-Control: Vercel-only; highest priority for Vercel's edge.
 *
 * @see https://vercel.com/docs/caching/cache-control-headers#cdn-cache-control-header
 */
export type VercelCacheHeader = 'Cache-Control' | 'CDN-Cache-Control' | 'Vercel-CDN-Cache-Control';

/**
 * Builds a cache header object for Vercel's CDN from explicit options.
 * Use with `Response.json(body, { headers: vercelCacheHeaders(options) })`.
 *
 * When options.private is true, returns Cache-Control: private, max-age=N (no CDN cache; browser may cache for N seconds).
 * Otherwise builds a public directive from maxAge, sMaxAge, and optional stale-*.
 *
 * @param options - Public: maxAge, sMaxAge, and optionally staleWhileRevalidate/staleIfError (use 0 to omit). Private: { private: true, maxAge }.
 * @param header - Which header to set. Defaults to `'Cache-Control'`.
 *
 * @see https://vercel.com/docs/caching/cache-control-headers
 * @see https://vercel.com/docs/caching/cache-control-headers#stale-while-revalidate
 */
export function vercelCacheHeaders(
  options: VercelCacheOptions,
  header: VercelCacheHeader = 'Cache-Control',
): Record<string, string> {
  if ('private' in options && options.private === true) {
    const { maxAge } = options;
    return { [header]: `private, max-age=${maxAge}` };
  }

  const opts = options as VercelCacheOptionsPublic;
  const { maxAge, sMaxAge, staleWhileRevalidate, staleIfError } = opts;

  let value = `public, max-age=${maxAge}, s-maxage=${sMaxAge}`;
  if (staleWhileRevalidate && staleWhileRevalidate > 0) {
    value += `, stale-while-revalidate=${staleWhileRevalidate}`;
  }
  if (staleIfError && staleIfError > 0) {
    value += `, stale-if-error=${staleIfError}`;
  }

  return { [header]: value };
}

/** Preset for semi-static list endpoints (e.g. site lists): short browser cache, 2 min CDN, SWR and stale-if-error. */
export const SEMI_STATIC_BURST_PROTECTION: VercelCacheOptionsPublic = {
  maxAge: 10,
  sMaxAge: 60,
  staleWhileRevalidate: 60,
  staleIfError: 3600,
};

/** Use for auth-gated responses (e.g. private sites). Pass to vercelCacheHeaders(). */
export const PRIVATE_CACHE_OPTIONS: VercelCacheOptionsPrivate = {
  private: true,
  maxAge: 60,
};
