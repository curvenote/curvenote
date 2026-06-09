import type { Context } from '../../context.server.js';

/** Split a normalized DOI (`prefix/suffix`) into API path segments. */
export function splitDoiForApiPath(
  normalizedDoi: string,
): { first: string; second: string } | null {
  const slash = normalizedDoi.indexOf('/');
  if (slash <= 0 || slash === normalizedDoi.length - 1) return null;
  return {
    first: normalizedDoi.slice(0, slash),
    second: normalizedDoi.slice(slash + 1),
  };
}

/** Build the global `/v1/doi/{first}/{second}` API URL for a normalized DOI. */
export function buildDoiApiUrl(
  ctx: Context,
  normalizedDoi: string,
  query?: { site?: string; tag?: string },
): string | undefined {
  const parts = splitDoiForApiPath(normalizedDoi);
  if (!parts) return undefined;
  const url = new URL(
    ctx.asApiUrl(`/doi/${encodeURIComponent(parts.first)}/${encodeURIComponent(parts.second)}`),
  );
  if (query?.site) url.searchParams.set('site', query.site);
  if (query?.tag) url.searchParams.set('tag', query.tag);
  return url.toString();
}
