import type { StorageBackend } from './backend.server.js';
import { KnownBuckets } from './constants.server.js';
import { File } from './file.server.js';
import type { UploadFileInfo, UploadStagingDTO, FileUploadResponse } from '@curvenote/common';
import pLimit from 'p-limit';
import { uuidv7 as uuid } from 'uuidv7';

export async function stageFilesForUpload(
  backend: StorageBackend,
  files: UploadFileInfo[],
  userId: string,
): Promise<UploadStagingDTO> {
  const limit = pLimit(backend.concurrency);

  // TODO: encountering 2 files with the same md5 causes fatal errors

  const targets: (UploadFileInfo | FileUploadResponse)[] = await Promise.all(
    files.map(async (info) =>
      limit(async () => {
        const stored_path = `${userId}/${info.md5}`;
        const stored = new File(backend, stored_path, KnownBuckets.hashstore);
        if (await stored.exists()) {
          return info;
        } else {
          const signed_url = await stored.signResumableUpload({ content_type: info.content_type });
          return {
            ...info,
            signed_url,
          };
        }
      }),
    ),
  );

  const cached = (targets as FileUploadResponse[]).filter((t) => !t.signed_url);
  const upload = (targets as FileUploadResponse[]).filter((t) => !!t.signed_url);

  return {
    cdnKey: uuid(),
    cached_items: cached,
    upload_items: upload,
  };
}
