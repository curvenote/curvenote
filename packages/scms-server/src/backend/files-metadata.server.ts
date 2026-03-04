import { ensureTrailingSlash } from '@curvenote/scms-core';
import type { FileMetadataSectionItem } from '@curvenote/scms-core';
import type { WorkVersionMetadata } from './metadata.js';
import type { Context } from './context.server.js';
import { File, KnownBuckets, StorageBackend } from './storage/index.js';

/**
 * Adds `signedUrl` to each entry in `metadata.files`.
 *
 * This is intended for UI consumption so file links can be downloaded from
 * file metadata alone (without a separate "sign this file" API call).
 *
 * - Does not mutate the input.
 * - If signing fails for a specific file, it leaves that file entry unchanged.
 */
export async function signFilesInMetadata<
  T extends WorkVersionMetadata & { files?: Record<string, FileMetadataSectionItem> },
>(metadata: T, cdn: string, ctx: Context) {
  if (!metadata || typeof metadata !== 'object' || !metadata.files) return metadata;

  const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.pub]);
  const isPrivateCdn = ctx.privateCdnUrls().has(ensureTrailingSlash(cdn));
  const bucket = isPrivateCdn ? KnownBuckets.prv : KnownBuckets.pub;

  const filesWithSignedUrls: Record<string, FileMetadataSectionItem> = {};
  await Promise.all(
    Object.entries(metadata.files).map(async ([key, file]) => {
      try {
        const fileInstance = new File(backend, file.path, bucket);
        const signedUrl = isPrivateCdn ? await fileInstance.sign() : await fileInstance.url();
        filesWithSignedUrls[key] = { ...file, signedUrl };
      } catch (err) {
        console.warn('Could not sign file for metadata', { path: file?.path, err });
        filesWithSignedUrls[key] = file;
      }
    }),
  );

  return { ...metadata, files: filesWithSignedUrls };
}
