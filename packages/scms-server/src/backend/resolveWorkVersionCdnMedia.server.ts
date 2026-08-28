import { getCdnBaseUrl, getCdnLocation, getConfig } from '@curvenote/cdn';
import type { CurvenoteSiteManifest } from '@curvenote/cdn';
import { ensureTrailingSlash } from '@curvenote/scms-core';
import type { SiteContext } from './context.site.server.js';
import { getSignedCDNQuery, signPrivateUrls } from './sign.private.server.js';

export type WorkVersionCdnSource = {
  id: string;
  work_id: string;
  cdn: string | null;
  cdn_key: string | null;
  thumbnail: string | null;
};

export type WorkVersionCdnMedia = {
  /** Signed thumbnail API URL when a thumb is known to exist; omit from SSR otherwise. */
  mediaThumbnailUrl: string | undefined;
  /**
   * CDN site manifest for the work version (when cdn+cdn_key exist).
   * Fetched once so callers can reuse for figures/equations/etc.
   */
  cdnConfig: CurvenoteSiteManifest | null;
};

/** Same lookup order as `@curvenote/cdn` `getThumbnailBuffer`. */
export function cdnManifestHasThumbnail(config: CurvenoteSiteManifest): boolean {
  return Boolean(
    config.thumbnail ??
      config.projects?.[0]?.thumbnail ??
      config.projects?.[0]?.pages?.find((page) => page.thumbnail)?.thumbnail,
  );
}

async function loadWorkVersionCdnConfig(
  ctx: SiteContext,
  cdn: string,
  cdnKey: string,
): Promise<CurvenoteSiteManifest | null> {
  try {
    const location = await getCdnLocation({ cdn, key: cdnKey });
    const baseUrl = await getCdnBaseUrl(location);
    let query: string | undefined;
    if (ctx.privateCdnUrls().has(ensureTrailingSlash(location.cdn))) {
      query = getSignedCDNQuery(ctx, baseUrl);
    }
    return await getConfig({ ...location, query });
  } catch (err) {
    console.warn('[cdn-media] failed to load work version CDN config', { cdn, cdnKey, err });
    return null;
  }
}

function signedSiteWorkVersionThumbnailUrl(
  ctx: SiteContext,
  siteName: string,
  workId: string,
  versionId: string,
  cdn: string,
  cdnKey: string,
): string {
  const { thumbnail } = signPrivateUrls(
    ctx,
    { cdn, key: cdnKey },
    ctx.asApiUrl(`/sites/${siteName}/works/${workId}/versions/${versionId}/thumbnail`),
    'no-social',
  );
  return thumbnail;
}

/**
 * Resolve whether a work version has a thumbnail for SSR-safe UI (e.g. site-admin MEDIA).
 * Does not change shared `links.thumbnail` emission on APIs — callers opt in.
 */
export async function resolveWorkVersionCdnMedia(
  ctx: SiteContext,
  siteName: string,
  wv: WorkVersionCdnSource,
): Promise<WorkVersionCdnMedia> {
  if (!wv.cdn || !wv.cdn_key) {
    return { mediaThumbnailUrl: undefined, cdnConfig: null };
  }

  const cdnConfig = await loadWorkVersionCdnConfig(ctx, wv.cdn, wv.cdn_key);
  const url = signedSiteWorkVersionThumbnailUrl(
    ctx,
    siteName,
    wv.work_id,
    wv.id,
    wv.cdn,
    wv.cdn_key,
  );

  if (wv.thumbnail) {
    return { mediaThumbnailUrl: url, cdnConfig };
  }

  if (cdnConfig && cdnManifestHasThumbnail(cdnConfig)) {
    return { mediaThumbnailUrl: url, cdnConfig };
  }

  return { mediaThumbnailUrl: undefined, cdnConfig };
}
