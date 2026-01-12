import type { HostSpec } from '@curvenote/common';
import * as cdnlib from '@curvenote/cdn';
import type { DBO as SiteDBO } from './loaders/sites/get.server.js';
import NodeCache from 'node-cache';
import type { Context } from './context.server.js';

export async function getSitePublicKey(
  site: SiteDBO,
  propertyPublicKey: string,
): Promise<string | null> {
  if (site.private) {
    // TODO - keys are shared across sites, need to move to a per-site key by calling back to the
    // origin site to get the public key once we've confirmed the origin against our DB or move to another
    // auth provider
    return propertyPublicKey.replace(/\\n/g, '\n');
  }
  return null;
}

/**
 * For use with private sites, this function will generate a signed CDN query
 * scoped to the baseURL
 *
 * @param baseUrl
 * @returns
 */
export function getSignedCDNQuery(ctx: Context, baseUrl: string) {
  // TODO not getting types well here
  const signingInfo = Object.entries(
    ctx.$config.api.privateCDNSigningInfo as Record<string, { keyName: string; key: string }>,
  )
    .filter(([key]) => baseUrl.includes(key))
    .map(([, value]) => value);

  if (signingInfo.length === 0) return '';
  if (signingInfo.length > 1) console.warn('Multiple signing keys found for', baseUrl);

  // TODO memcache this?
  return cdnlib.getSignedCDNQuery({
    urlPrefix: baseUrl,
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    keyName: signingInfo[0].keyName,
    keyBase64: signingInfo[0].key,
  });
}

const cache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60, maxKeys: 1000 });

/**
 * Will automatically sign urls for known private CDNs
 *
 * @param host
 * @param thumbnail
 * @param social
 * @returns
 */
export function signPrivateUrls(ctx: Context, host: HostSpec, thumbnail: string, social: string) {
  const { cdn, key } = host;
  const cdnBaseUrl = `${cdn}${key.replace(/\./g, '/')}/`;

  let query;
  if (cache.has(cdnBaseUrl)) {
    query = cache.get(cdnBaseUrl);
  } else {
    if (!ctx.privateCdnUrls().has(host.cdn))
      return { host, thumbnail, social, config: `${cdnBaseUrl}config.json` };

    query = getSignedCDNQuery(ctx, cdnBaseUrl);
    cache.set(cdnBaseUrl, query);
  }

  return {
    host: { cdn, key, query } as HostSpec,
    thumbnail: `${thumbnail}?${query}`,
    social: `${social}?${query}`,
    config: `${cdnBaseUrl}config.json?${query}`,
  };
}
