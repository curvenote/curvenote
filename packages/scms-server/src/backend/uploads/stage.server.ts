import { StorageBackend } from '../storage/backend.server.js';
import { KnownBuckets } from '../storage/constants.server.js';
import { stageFilesForUpload } from '../storage/upload.resumable.server.js';
import type { UploadFileInfo } from '@curvenote/common';
import { getPrismaClient } from '../prisma.server.js';
import type { FileMetadataSection, FileUploadConfig, PerFileError } from '@curvenote/scms-core';
import { assertUserDefined } from '../secure.server.js';
import { TrackEvent } from '@curvenote/scms-core';
import type { Context } from '../context.server.js';
import type { WorkContext } from '../context.work.server.js';
import type { SiteContext } from '../context.site.server.js';
import { data as dataResponse } from 'react-router';

export async function workVersionUploadsStage(
  ctx: WorkContext,
  uploadConfig: FileUploadConfig,
  formData: FormData,
  workVersionId: string,
) {
  const prisma = await getPrismaClient();
  const workVersion = await prisma.workVersion.findFirst({
    where: { id: workVersionId },
    orderBy: { date_created: 'desc' },
  });
  if (!workVersion) {
    throw new Error('Work version not found');
  }
  return uploadsStage(
    ctx,
    uploadConfig,
    formData,
    workVersion.metadata as FileMetadataSection | null,
  );
}

export async function siteUploadsStage(
  ctx: SiteContext,
  uploadConfig: FileUploadConfig,
  formData: FormData,
) {
  return uploadsStage(ctx, uploadConfig, formData, ctx.site.data as FileMetadataSection | null);
}

export async function uploadsStage(
  ctx: Context,
  uploadConfig: FileUploadConfig,
  formData: FormData,
  data: FileMetadataSection | null,
) {
  assertUserDefined(ctx.user);

  const files = formData
    .getAll('files')
    .map((file) => JSON.parse(file as string)) as UploadFileInfo[];
  const slot = formData.get('slot') as string;

  if (uploadConfig.slot !== slot) {
    return dataResponse(
      {
        error: {
          type: 'general',
          message: 'Slot does not match upload configuration',
          details: {
            configuredSlot: uploadConfig.slot,
            slot,
          },
        },
      },
      { status: 400 },
    );
  }

  // Return empty result if no files provided
  if (!files.length) {
    return {
      cached_items: [],
      upload_items: [],
      error_items: [],
    };
  }

  if (uploadConfig.maxFiles !== undefined) {
    const currentFiles = Object.values(data?.files || {}).filter(
      (file) => file.slot === slot,
    ).length;
    const newTotalFiles = currentFiles + files.length;
    if (newTotalFiles > uploadConfig.maxFiles) {
      return dataResponse(
        {
          error: {
            type: 'general',
            message: 'Maximum number of files exceeded',
            details: {
              currentFiles,
              maxFiles: uploadConfig.maxFiles,
              attemptedFiles: files.length,
            },
          },
        },
        { status: 400 },
      );
    }
  }

  if (!uploadConfig.multiple && files.length > 1) {
    return dataResponse(
      {
        error: {
          type: 'general',
          error: 'Multiple files not allowed for this slot',
          details: { slot: uploadConfig.slot },
        },
      },
      { status: 400 },
    );
  }

  // Per-file errors
  const perFileErrors: PerFileError[] = [];

  // Validate file types
  if (uploadConfig.mimeTypes !== undefined) {
    const allowedTypes = uploadConfig.mimeTypes;
    files.forEach((file) => {
      if (!allowedTypes.includes(file.content_type)) {
        perFileErrors.push({
          path: file.path,
          error: 'Invalid file type',
          details: { allowedTypes: uploadConfig.mimeTypes },
        });
      }
    });
  }

  // Validate file sizes
  if (uploadConfig.maxSize) {
    files.forEach((file) => {
      if (uploadConfig.maxSize !== undefined && file.size > uploadConfig.maxSize) {
        perFileErrors.push({
          path: file.path,
          error: 'File size too large',
          details: { maxSize: uploadConfig.maxSize },
        });
      }
    });
  }

  // Check for duplicate files across ALL slots
  const allExistingFiles = Object.values(data?.files || {});

  if (!uploadConfig.ignoreDuplicates) {
    files.forEach((file) => {
      // Check for duplicate by MD5 hash (same file content) across all slots - PRIMARY CHECK
      const duplicateByHash = allExistingFiles.find(
        (existingFile) => existingFile.md5 === file.md5,
      );
      if (duplicateByHash) {
        perFileErrors.push({
          path: file.path,
          error: 'duplicate_file_content',
          details: {
            existingFile: duplicateByHash.name,
            existingSlot: duplicateByHash.slot,
            message: `File with same content already exists as "${duplicateByHash.name}" in ${duplicateByHash.slot}`,
          },
        });
        return; // Skip filename check if hash duplicate found
      }

      // Check for duplicate by filename across all slots (secondary check)
      const fileName = file.path.split('/').pop() || '';
      const duplicateByName = allExistingFiles.find(
        (existingFile) => existingFile.name === fileName,
      );
      if (duplicateByName) {
        perFileErrors.push({
          path: file.path,
          error: 'duplicate_file_name',
          details: {
            existingFile: duplicateByName.name,
            existingSlot: duplicateByName.slot,
            message: `File with same name already exists in ${duplicateByName.slot}`,
          },
        });
      }
    });
  }

  const invalidFilePaths = perFileErrors.map((error) => error.path);
  const validFiles: UploadFileInfo[] = files.filter(
    (file) => !invalidFilePaths.includes(file.path),
  );

  const backend = new StorageBackend(ctx, [KnownBuckets.hashstore]);
  const result = await stageFilesForUpload(backend, validFiles, ctx.user.id!);

  // cdnKey is just a unique identifier for the upload and has not been applied anywhere
  // yet, so we can just remove it here
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cdnKey, ...rest } = result;

  const dto = {
    ...rest,
    error_items: perFileErrors.length > 0 ? perFileErrors : undefined,
  };

  await ctx.trackEvent(TrackEvent.FILES_STAGED, {
    slot,
    fileCount: validFiles.length,
    totalSize: validFiles.reduce((sum, file) => sum + file.size, 0),
    fileTypes: [...new Set(validFiles.map((f) => f.content_type))],
    cachedCount: dto.cached_items?.length || 0,
    uploadCount: dto.upload_items?.length || 0,
    errorCount: perFileErrors.length,
  });

  return dto;
}
