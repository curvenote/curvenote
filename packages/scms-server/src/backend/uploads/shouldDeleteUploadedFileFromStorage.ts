export type ShouldDeleteUploadedFileFromStorageArgs = {
  isLatestVersion: boolean;
  filePath: string;
  workVersionCdnKey: string | null | undefined;
  hasFileMetadata: boolean;
};

/**
 * Whether permanent storage deletion is allowed for a file removal on a work version.
 * New per-file removal paths must delegate to this helper (see workVersionUploadRemove).
 */
export function shouldDeleteUploadedFileFromStorage(
  args: ShouldDeleteUploadedFileFromStorageArgs,
): boolean {
  if (!args.isLatestVersion || !args.hasFileMetadata) return false;
  if (!args.workVersionCdnKey) return false;

  const firstSegment = args.filePath.split('/')[0];
  return firstSegment === args.workVersionCdnKey;
}
