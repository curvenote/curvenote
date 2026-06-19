/**
 * Resolve a user-selected document figure into the work version's persisted thumbnail.
 *
 * Candidate figures are downscaled to compact webp and written to object storage at
 * parse time (see fetchPreviews.server.ts → extractAndStoreFigures), under the work
 * version's `thumbnails/` subpath. The selection locator IS the storage key, so
 * materialisation is purely path-based: validate that the submitted key belongs to this
 * work version's cached candidate figures, then return it to be stored in
 * `WorkVersion.thumbnail` (layer 1 of the thumbnail cascade).
 *
 * Returns `null` when the locator is missing/unknown — the caller treats the thumbnail
 * as best-effort and never blocks submission on it.
 */
import type { Context } from '@curvenote/scms-server';
import { decodeFigureLocator } from './thumbnailSelection';
import { readPreviewFigureKeysForVersion } from './fetchPreviews.server';

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

  // Validate the submitted key against this version's candidate figures, so an arbitrary
  // storage key can't be written into the thumbnail column.
  const validKeys = await readPreviewFigureKeysForVersion(workVersionId);
  if (!validKeys.has(key)) {
    console.warn('materializeSelectedThumbnail: locator not a known candidate figure', {
      workVersionId,
      key,
    });
    return null;
  }

  return key;
}
