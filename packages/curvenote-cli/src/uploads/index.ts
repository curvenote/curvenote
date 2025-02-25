import type { ISession } from '../session/types.js';
import type { UploadFileInfo } from '@curvenote/common';
import { stageUploads } from './stage.js';
import { commitUploads } from './commit.js';
import { performFileUploads } from './utils.js';
import type { SignedFileInfo } from './types.js';

export * from './types.js';
export * from './utils.js';

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
        const { signed_url, ...rest } = f;
        return rest as UploadFileInfo;
      }),
    ],
  });

  return { cdnKey };
}
