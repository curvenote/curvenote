import { getCdnBaseUrl, getCdnLocation, getConfig } from '@curvenote/cdn';
import type { CurvenoteSiteManifest } from '@curvenote/cdn';
import { ensureTrailingSlash } from '@curvenote/scms-core';
import { getSignedCDNQuery, signPrivateUrls, type SiteContext } from '@curvenote/scms-server';

export type ActiveWorkVersionCdnSource = {
  id: string;
  work_id: string;
  cdn: string | null;
  cdn_key: string | null;
  thumbnail: string | null;
};

export type ActiveVersionCdnMedia = {
  /** Signed thumbnail API URL when a thumb is known to exist; omit from SSR otherwise. */
  mediaThumbnailUrl: string | undefined;
  /**
   * CDN site manifest for the active work version (when cdn+cdn_key exist).
   * Fetched once for MEDIA now; reuse for figures/equations/etc. next.
   */
  activeVersionCdnConfig: CurvenoteSiteManifest | null;
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
    console.warn('[submission-detail] failed to load active version CDN config', {
      cdn,
      cdnKey,
      err,
    });
    return null;
  }
}

function signedThumbnailUrl(
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
 * Details-page-only: decide whether MEDIA should render a thumbnail on SSR.
 * Does not change shared `links.thumbnail` emission on APIs.
 */
export async function resolveActiveVersionCdnMedia(
  ctx: SiteContext,
  siteName: string,
  wv: ActiveWorkVersionCdnSource,
): Promise<ActiveVersionCdnMedia> {
  if (!wv.cdn || !wv.cdn_key) {
    return { mediaThumbnailUrl: undefined, activeVersionCdnConfig: null };
  }

  const activeVersionCdnConfig = await loadWorkVersionCdnConfig(ctx, wv.cdn, wv.cdn_key);
  const url = signedThumbnailUrl(ctx, siteName, wv.work_id, wv.id, wv.cdn, wv.cdn_key);

  if (wv.thumbnail) {
    return { mediaThumbnailUrl: url, activeVersionCdnConfig };
  }

  if (activeVersionCdnConfig && cdnManifestHasThumbnail(activeVersionCdnConfig)) {
    return { mediaThumbnailUrl: url, activeVersionCdnConfig };
  }

  return { mediaThumbnailUrl: undefined, activeVersionCdnConfig };
}
