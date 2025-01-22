export * from './makeDefaultConfig.js';
export * from './getConfigPath.js';
export * from './getLogLevel.js';
export * from './checkVersionRejections.js';

export function withQuery(url: string, query: Record<string, string> = {}) {
  const params = Object.entries(query ?? {})
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  if (params.length === 0) return url;
  return url.indexOf('?') === -1 ? `${url}?${params}` : `${url}&${params}`;
}

export function ensureBaseUrl(url: string, baseUrl: string) {
  try {
    const u = new URL(url);
    return u.toString();
  } catch (e: any) {
    const ub = new URL(`${baseUrl}${url}`);
    return ub.toString();
  }
}
