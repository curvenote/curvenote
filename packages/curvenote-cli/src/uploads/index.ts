import type { ISession } from '../session/types.js';
import type { UploadFileInfo } from '@curvenote/common';
import { stageUploads, stageWithRequest } from './stage.js';
import { commitUploads } from './commit.js';
import { makeFileInfo, performFileUploads } from './utils.js';
import type { SignedFileInfo } from './types.js';

export * from './types.js';
export * from './utils.js';

/** One named file: local path on disk and storage path under the cdnKey. */
export type NamedFile = {
  localPath: string;
  storagePath: string;
};

export type UploadNamedFilesOpts = {
  cdn: string;
  cdnKey: string;
  /** Explicit list of localPath → storagePath. No folder scanning. */
  files: NamedFile[];
  resume?: boolean;
};

/**
 * Upload a list of named files to chosen storage paths under an existing cdnKey.
 * No folder scanning: each entry is an explicit localPath/storagePath pair.
 * Stages all files, uploads to signed URLs as needed, then commits with the given cdnKey
 * so each file lands at {cdnKey}/{storagePath}.
 */
export async function uploadNamedFilesToCdn(
  session: ISession,
  opts: UploadNamedFilesOpts,
): Promise<{ paths: string[]; cdnKey: string }> {
  if (opts.files.length === 0) {
    return { paths: [], cdnKey: opts.cdnKey };
  }

  const fileInfos = opts.files.map((f) => makeFileInfo(f.localPath, f.storagePath));
  const uploadRequest = {
    files: fileInfos.map((info) => ({
      path: info.to,
      content_type: info.contentType,
      md5: info.md5,
      size: info.size,
    })),
  };
  const staged = await stageWithRequest(session, uploadRequest);

  // Pass `upload` (protocol + URL) so performFileUploads can use GCS resumable vs single PUT (Azure/S3).
  const filesToUpload: SignedFileInfo[] = staged.upload_items
    .map((upload) => {
      const fileInfo = fileInfos.find((f) => f.md5 === upload.md5);
      if (!fileInfo) return null;
      return {
        from: fileInfo.from,
        to: upload.path,
        md5: fileInfo.md5,
        size: fileInfo.size,
        contentType: fileInfo.contentType,
        signedUrl: upload.signed_url,
        ...(upload.upload ? { upload: upload.upload } : {}),
      };
    })
    .filter((f): f is SignedFileInfo => f !== null);

  if (filesToUpload.length > 0) {
    await performFileUploads(session, filesToUpload, { resume: opts.resume });
  }

  // Commit only stable file metadata; signed_url and upload are upload-time secrets/protocol hints, not part of UploadFileInfo.
  const files: UploadFileInfo[] = [
    ...staged.cached_items,
    ...staged.upload_items.map((f) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signed_url, upload: _upload, ...rest } = f;
      return rest as UploadFileInfo;
    }),
  ];
  await commitUploads(session, {
    cdn: opts.cdn,
    cdnKey: opts.cdnKey,
    files,
  });

  const paths = opts.files.map((f) => `${opts.cdnKey}/${f.storagePath}`);
  return { paths, cdnKey: opts.cdnKey };
}

export type UploadSingleFileOpts = {
  cdn: string;
  cdnKey: string;
  localPath: string;
  storagePath: string;
  resume?: boolean;
};

/**
 * Upload a single file to a chosen storage path under an existing cdnKey.
 * Convenience wrapper around uploadNamedFilesToCdn with one file.
 */
export async function uploadSingleFileToCdn(
  session: ISession,
  opts: UploadSingleFileOpts,
): Promise<{ path: string; cdnKey: string }> {
  const { paths, cdnKey } = await uploadNamedFilesToCdn(session, {
    cdn: opts.cdn,
    cdnKey: opts.cdnKey,
    files: [{ localPath: opts.localPath, storagePath: opts.storagePath }],
    resume: opts.resume,
  });
  return { path: paths[0]!, cdnKey };
}

export async function uploadToTmpCdn(session: ISession, opts?: { resume?: boolean }) {
  return uploadToCdn(session, session.config.tempCdnUrl, opts);
}

export async function uploadToCdn(session: ISession, cdn: string, opts?: { resume?: boolean }) {
  const { cdnKey, cached_items, upload_items, files } = await stageUploads(session);

  const filesToUpload = files
    .map((file) => {
      const upload = upload_items.find((f) => f.md5 === file.md5);
      if (!upload) {
        session.log.error(
          `🚨 Could not find upload url for ${file.md5} ${file.from}, upload will be skipped`,
        );
        return null;
      }

      return {
        from: file.from,
        to: upload.path,
        md5: file.md5,
        size: file.size,
        contentType: file.contentType,
        signedUrl: upload.signed_url,
        ...(upload.upload ? { upload: upload.upload } : {}),
      };
    })
    .filter((f): f is SignedFileInfo => f !== null);

  if (filesToUpload.length > 0) {
    await performFileUploads(session, filesToUpload, opts);
  }

  await commitUploads(session, {
    cdn,
    cdnKey,
    files: [
      ...cached_items,
      ...upload_items.map((f) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { signed_url, upload: _upload, ...rest } = f;
        return rest as UploadFileInfo;
      }),
    ],
  });

  return { cdnKey };
}
