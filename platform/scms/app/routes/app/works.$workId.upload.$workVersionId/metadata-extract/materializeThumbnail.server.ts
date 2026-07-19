/**
 * Resolve a user-selected document figure into the work version's persisted thumbnail.
 */
import type { Context } from '@curvenote/scms-server';
import { findWorkByVersion } from '@curvenote/scms-server';
import { decodeFigureLocator } from './thumbnailSelection';
import { METADATA_THUMBNAILS_KEY, readPreviewFigureKeysForVersion } from './fetchPreviews.server';

function collectStoredThumbnailKeys(
  metadata: unknown,
  versionThumbnail: string | null,
): Set<string> {
  const keys = new Set<string>();
  if (versionThumbnail) keys.add(versionThumbnail);

  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return keys;
  }

  const listing = (metadata as Record<string, unknown>)[METADATA_THUMBNAILS_KEY];
  if (!Array.isArray(listing)) return keys;

  for (const entry of listing) {
    if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
      const key = (entry as { key?: unknown }).key;
      if (typeof key === 'string' && key.trim()) keys.add(key);
    }
  }

  return keys;
}

export async function materializeSelectedThumbnail({
  workVersionId,
  locator,
}: {
  ctx: Context;
  workVersionId: string;
  cdn: string;
  locator: string;
}): Promise<string | null> {
  const key = decodeFigureLocator(locator);
  if (!key) {
    console.warn('materializeSelectedThumbnail: could not decode locator', locator);
    return null;
  }

  const validKeys = await readPreviewFigureKeysForVersion(workVersionId);
  const work = await findWorkByVersion(workVersionId);
  const storedKeys = collectStoredThumbnailKeys(work?.metadata, work?.thumbnail ?? null);
  for (const storedKey of storedKeys) {
    validKeys.add(storedKey);
  }

  if (!validKeys.has(key)) {
    console.warn('materializeSelectedThumbnail: locator not a known candidate figure', {
      workVersionId,
      key,
    });
    return null;
  }

  return key;
}
