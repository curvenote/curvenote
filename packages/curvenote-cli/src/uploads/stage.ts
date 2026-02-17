import type { ISession } from '../session/types.js';
import { postToJournals } from '../utils/api.js';
import { prepareUploadRequest } from './utils.js';
import type { UploadStagingDTO } from '@curvenote/common';
import type { SiteUploadRequest } from '@curvenote/blocks';

/**
 * POST an arbitrary upload request to the stage API. Does not scan session.sitePath().
 * Use this for single-file or custom folder uploads (e.g. uploadSingleFileToCdn).
 *
 * @param session
 * @param uploadRequest - { files: [{ path, content_type, md5, size }] }
 * @returns Staging DTO (cdnKey, cached_items, upload_items)
 */
export async function stageWithRequest(
  session: ISession,
  uploadRequest: SiteUploadRequest,
): Promise<UploadStagingDTO> {
  const resp = await postToJournals(session, `/uploads/stage`, uploadRequest, { method: 'POST' });
  if (!resp.ok) {
    throw new Error(`🤕 Failed to stage uploads: ${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as UploadStagingDTO;
}

/**
 * Scans the project folder, gets the list of files to upload and then asked the
 * API to stage them. The response contains the cdnKey to use, and maps (keyed by md5)
 * of cached files and files that need to be uploaded.
 *
 * @param session
 * @returns cdnKey to be used for upload, cached and upload maps and a filtered files
 * listing containing only the files that need to be uploaded.
 */
export async function stageUploads(session: ISession) {
  const { files, uploadRequest } = await prepareUploadRequest(session);
  const resp = await postToJournals(session, `/uploads/stage`, uploadRequest, { method: 'POST' });
  if (resp.ok) {
    const staged = (await resp.json()) as UploadStagingDTO;
    if (staged.upload_items.length === 0) {
      session.log.info('✅ no new files need to be uploaded.');
    } else {
      session.log.info(
        `📤 Staging complete - ${staged.upload_items.length}/${files.length} files need to be uploaded.`,
      );
    }

    uploadRequest.files.forEach((f) => {
      session.log.debug(`📁 ${f.path} found ${f.md5}.`);
    });

    staged.cached_items.forEach((f) => {
      session.log.debug(`📦 ${f.md5} ${f.path} cached.`);
    });

    staged.upload_items.forEach((f) => {
      session.log.debug(`🆙 ${f.md5} ${f.path} to upload.`);
    });

    const toUpload = staged.upload_items.map((f) => f.md5);

    return { ...staged, files: files.filter((f) => toUpload.includes(f.md5)) };
  }

  throw new Error(`🤕 Failed to stage uploads: ${resp.status} ${resp.statusText}`);
}
