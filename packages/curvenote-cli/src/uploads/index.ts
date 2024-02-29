import type { ISession } from '../session/types.js';
import type { UploadFileInfo } from '@curvenote/common';
import { stageUploads } from './stage.js';
import { commitUploads } from './commit.js';
import { performFileUploads } from './utils.js';

export * from './types.js';
export * from './utils.js';

export async function uploadToTmpCdn(session: ISession, opts?: { resume?: boolean }) {
  return uploadToCdn(session, 'https://tmp.curvenote.dev/', opts);
}

export async function uploadToCdn(session: ISession, cdn: string, opts?: { resume?: boolean }) {
  const { cdnKey, cached, upload, files } = await stageUploads(session);

  const filesToUpload = files.map((file) => {
    return {
      from: file.from,
      to: upload[file.md5].path,
      md5: file.md5,
      size: file.size,
      contentType: file.contentType,
      signedUrl: upload[file.md5].signed_url,
    };
  });

  if (filesToUpload.length > 0) {
    await performFileUploads(session, filesToUpload, opts);
  }

  await commitUploads(session, {
    cdn,
    cdnKey,
    files: [
      ...Object.values(cached),
      ...Object.values(upload).map((f) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { signed_url, ...rest } = f;
        return rest as UploadFileInfo;
      }),
    ],
  });

  return { cdnKey };
}
