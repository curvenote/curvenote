import { data as dataResponse } from 'react-router';
import { safeWorkVersionJsonUpdate } from '../occ.server.js';
import { TrackEvent, coerceToObject } from '@curvenote/scms-core';
import type { FileMetadataSection } from '@curvenote/scms-core';
import type { WorkVersionMetadata } from '../metadata.js';
import { StorageBackend } from '../storage/backend.server.js';
import { File } from '../storage/file.server.js';
import { KnownBuckets } from '../storage/constants.server.js';
import type { WorkContext } from '../context.work.server.js';

export async function workVersionUploadRemove(
  ctx: WorkContext,
  formData: FormData,
  workVersionId: string,
  cdn: string,
) {
  const path = formData.get('path') as string;
  const slot = formData.get('slot') as string;

  if (!path || !slot) {
    return dataResponse({ error: 'Path and slot are required' }, { status: 400 });
  }

  /**
   * SAFETY CHECK: Multiple Submission Version Protection
   *
   * We now support multiple submission versions and work versions
   * for a given submission. When creating new versions, we copy forward all metadata
   * including file metadata, which means multiple work versions can reference the
   * same files on CDN storage.
   *
   * To prevent accidental deletion of files that are still referenced by other
   * work versions, we implement the following safety checks for permanent storage deletion:
   *
   * 1. We only delete from permanent storage when operating on the LATEST work version
   * 2. The first segment of the file path must match the CDN key stored in the work version
   *
   * This ensures that:
   * - Previous work versions remain immutable
   * - Files are only deleted from storage when they are truly "orphaned"
   * - Metadata changes always proceed (for UI consistency)
   * - We maintain data integrity across the versioning system
   */

  // Get the current work version from the context
  if (!ctx.work.versions || ctx.work.versions.length === 0) {
    return dataResponse({ error: 'No work versions found in context' }, { status: 404 });
  }

  const currentWorkVersion = ctx.work.versions.find((v) => v.id === workVersionId);
  if (!currentWorkVersion) {
    return dataResponse({ error: 'Work version not found in context' }, { status: 404 });
  }

  // Check if we're operating on the latest work version (versions are already sorted by date_created desc)
  const isLatestVersion = ctx.work.versions[0].id === workVersionId;

  // Get the file metadata from the current work version
  const workVersionMetadata = currentWorkVersion.metadata as FileMetadataSection | null;
  const fileMetadata = workVersionMetadata?.files?.[path];
  if (!fileMetadata) {
    console.warn(`File ${path} not found in metadata, skipping storage deletion`);
  }

  // Determine if we should delete from permanent storage
  let shouldDeleteFromStorage = false;
  let storageDeletionReason = '';

  if (isLatestVersion && fileMetadata) {
    // Check if the first segment of the file path matches the work version's CDN key
    const filePathSegments = path.split('/');
    const firstSegment = filePathSegments[0];
    const workVersionCdnKey = currentWorkVersion.cdn_key;

    if (firstSegment === workVersionCdnKey) {
      shouldDeleteFromStorage = true;
      storageDeletionReason = 'Latest work version with matching CDN key';
    } else {
      storageDeletionReason = `CDN key mismatch: file path starts with '${firstSegment}', work version CDN key is '${workVersionCdnKey}'`;
    }
  } else if (!isLatestVersion) {
    storageDeletionReason = 'Not the latest work version';
  } else {
    storageDeletionReason = 'File metadata not found';
  }

  console.log(
    `File deletion analysis for ${path}: ` +
      `Latest version: ${isLatestVersion}, Storage deletion: ${shouldDeleteFromStorage}, Reason: ${storageDeletionReason}`,
  );

  // Conditionally remove from permanent storage based on safety checks
  if (shouldDeleteFromStorage) {
    const backend = new StorageBackend(ctx, [KnownBuckets.prv, KnownBuckets.tmp]);
    const file = new File(backend, path, backend.knownBucketFromCDN(cdn));

    try {
      const exists = await file.exists();
      if (!exists) {
        console.warn(`File ${path} does not exist in storage, skipping deletion`);
      } else {
        await file.delete();
        console.log(`File ${path} successfully deleted from storage: ${storageDeletionReason}`);
      }
    } catch (error) {
      console.error(`Error removing file ${path} from storage:`, error);
      // Continue with metadata update even if storage removal fails
    }
  } else {
    console.log(`Skipping storage deletion for ${path}: ${storageDeletionReason}`);
  }

  try {
    await safeWorkVersionJsonUpdate<WorkVersionMetadata & FileMetadataSection>(
      workVersionId,
      (metadata) => {
        const readMetadata = coerceToObject(metadata);
        const updatedMetadata: WorkVersionMetadata & FileMetadataSection = {
          version: 1,
          ...readMetadata,
          files: { ...(readMetadata?.files || {}) },
        };

        // Remove the file from metadata
        delete updatedMetadata.files[path];

        return updatedMetadata as any;
      },
    );

    console.log(`File ${path} successfully removed from metadata`);

    await ctx.trackEvent(TrackEvent.FILE_REMOVED, {
      slot,
      workVersionId,
      filePath: path,
      fileName: path.split('/').pop() || path,
      fileExtension: path.split('.').pop() || 'unknown',
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return dataResponse(
      {
        error: {
          type: 'general',
          error: 'Failed to remove file',
          details: { path, slot, error },
        },
      },
      { status: 500 },
    );
  }
}
