import { formatDate } from '@curvenote/common';
import { data as dataResponse } from 'react-router';
import type { UploadFileInfo } from '@curvenote/common';
import { safeWorkVersionJsonUpdate, safeSiteDataUpdate } from '../occ.server.js';
import { TrackEvent, coerceToObject, generateUniqueFileLabel } from '@curvenote/scms-core';
import { makeDefaultWorkVersionMetadata } from '../metadata.js';
import type { FileMetadataSection } from '@curvenote/scms-core';
import pLimit from 'p-limit';
import { File } from '../storage/file.server.js';
import { KnownBuckets } from '../storage/constants.server.js';
import { StorageBackend } from '../storage/backend.server.js';
import type { SiteContext } from '../context.site.server.js';
import type { WorkContext } from '../context.work.server.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadsComplete(
  ctx: WorkContext | SiteContext,
  formData: FormData,
  targetBucket: KnownBuckets,
  buckets: KnownBuckets[],
  updateMetadata: (successfullyCopied: UploadFileInfo[], slot: string) => Promise<void>,
  trackingData: Record<string, any>,
) {
  const completedFilesData = JSON.parse(formData.get('completedFiles') as string);

  const slot = formData.get('slot') as string;
  const completedFiles = Array.isArray(completedFilesData)
    ? completedFilesData.filter(
        (item): item is UploadFileInfo =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.path === 'string' &&
          typeof item.content_type === 'string' &&
          typeof item.md5 === 'string' &&
          typeof item.size === 'number',
      )
    : [];

  // Copy files from hashstore to target bucket
  const backend = new StorageBackend(ctx, buckets);

  const limit = pLimit(5);
  const copyErrors: { path: string; error: string }[] = [];
  const successfullyCopied: UploadFileInfo[] = [];

  await Promise.all(
    completedFiles.map((file) =>
      limit(async () => {
        // The path in file.path is the requested storage path in the persistent bucket.
        // the hashstore path is a combination of the uploading user's id and the md5 hash of the file.
        const srcPath = `${ctx.user?.id}/${file.md5}`;
        const src = new File(backend, srcPath, KnownBuckets.hashstore);
        const destPath = file.path;
        let lastError: any = null;
        for (let retry = 0; retry < 3; retry++) {
          try {
            await src.copy(destPath, targetBucket);
            successfullyCopied.push(file);
            return;
          } catch (err) {
            lastError = err;
            if (retry < 2) {
              await sleep(100);
            }
          }
        }
        copyErrors.push({ path: file.path, error: lastError?.message || 'Unknown error' });
      }),
    ),
  );

  try {
    await updateMetadata(successfullyCopied, slot);

    const errorItems = copyErrors.map(({ path, error }) => ({ path, error, details: {} }));

    await ctx.trackEvent(TrackEvent.FILES_UPLOADED, {
      slot,
      ...trackingData,
      fileCount: completedFiles.length,
      totalSize: completedFiles.reduce((sum, file) => sum + file.size, 0),
      fileTypes: [...new Set(completedFiles.map((f) => f.content_type))],
      successCount: completedFiles.length - errorItems.length,
      errorCount: errorItems.length,
      success: errorItems.length === 0,
    });

    if (errorItems.length > 0) {
      return { success: false, items: completedFiles, error_items: errorItems };
    }
    return { success: true, items: completedFiles };
  } catch (error) {
    console.error(error);
    return dataResponse(
      {
        error: {
          type: 'general',
          message: 'Failed to complete uploads',
          items: completedFiles,
          details: { slot, error },
        },
      },
      { status: 500 },
    );
  }
}

/**
 * Helper function to add uploaded file info to metadata
 */
function finalizeFileMetadata(
  metadata: FileMetadataSection,
  uploadedFiles: UploadFileInfo[],
  slot: string,
) {
  // Collect existing labels for uniqueness check
  const existingLabels = new Set<string>();
  Object.values(metadata.files).forEach((file: any) => {
    if (file.label) {
      existingLabels.add(file.label);
    }
  });

  // Only update metadata for successfully copied files
  uploadedFiles.forEach((file: UploadFileInfo & { label?: string }, index: number) => {
    const filePath = file.path;
    if (!metadata.files[filePath]) {
      const fileName = filePath.split('/').pop() || '';

      // Use provided label if available, otherwise generate one
      let finalLabel: string;
      if (file.label && !existingLabels.has(file.label)) {
        finalLabel = file.label;
      } else {
        finalLabel = generateUniqueFileLabel(fileName, existingLabels);
      }

      // Add the new label to the set to prevent conflicts with subsequent files
      existingLabels.add(finalLabel);

      // Get the next order number for this slot (allowing gaps for future manual reordering)
      const existingFilesInSlot = Object.values(metadata.files).filter((f: any) => f.slot === slot);
      const maxOrder =
        existingFilesInSlot.length > 0
          ? Math.max(...existingFilesInSlot.map((f: any) => f.order ?? 0))
          : 0;
      const nextOrder = maxOrder + 1 + index;

      metadata.files[filePath] = {
        name: fileName,
        size: file.size,
        type: file.content_type,
        path: filePath,
        uploadDate: formatDate(),
        slot,
        md5: file.md5,
        label: finalLabel,
        order: nextOrder,
      };
    }
  });
  return metadata;
}

export async function workVersionUploadsComplete(
  ctx: WorkContext,
  formData: FormData,
  workVersionId: string,
  cdn: string,
) {
  const backend = new StorageBackend(ctx, [
    KnownBuckets.hashstore,
    KnownBuckets.prv,
    KnownBuckets.tmp,
  ]);
  const targetBucket = backend.knownBucketFromCDN(cdn);

  return uploadsComplete(
    ctx,
    formData,
    targetBucket,
    [KnownBuckets.hashstore, KnownBuckets.prv, KnownBuckets.tmp],
    async (successfullyCopied, slot) => {
      await safeWorkVersionJsonUpdate<FileMetadataSection>(workVersionId, (metadata) => {
        const readMetadata = coerceToObject(metadata);
        const updatedMetadata: FileMetadataSection = {
          ...makeDefaultWorkVersionMetadata(),
          ...readMetadata,
          files: { ...(readMetadata?.files || {}) },
        };

        return finalizeFileMetadata(updatedMetadata, successfullyCopied, slot);
      });
    },
    { workVersionId },
  );
}

export async function siteUploadsComplete(ctx: SiteContext, formData: FormData) {
  return uploadsComplete(
    ctx,
    formData,
    KnownBuckets.pub,
    [KnownBuckets.hashstore, KnownBuckets.pub, KnownBuckets.tmp],
    async (successfullyCopied, slot) => {
      await safeSiteDataUpdate<FileMetadataSection>(ctx.site.id, (data) => {
        const readData = coerceToObject(data);
        const updatedData: FileMetadataSection = {
          ...readData,
          files: { ...(readData?.files || {}) },
        };

        return finalizeFileMetadata(updatedData, successfullyCopied, slot) as FileMetadataSection;
      });
    },
    { siteId: ctx.site.id, siteName: ctx.site.name },
  );
}
