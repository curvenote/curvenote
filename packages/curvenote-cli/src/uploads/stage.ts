import type { ISession } from '../session/types.js';
import { postToJournals } from '../submissions/utils.js';
import { prepareUploadRequest } from './utils.js';
import type { UploadStagingDTO } from '@curvenote/common';

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
  const resp = await postToJournals(session, `uploads/stage`, uploadRequest, { method: 'POST' });
  if (resp.ok) {
    const staged = (await resp.json()) as UploadStagingDTO;
    if (Object.keys(staged.upload).length === 0) {
      session.log.info('✅ no new files need to be uploaded.');
    } else {
      session.log.info(
        `📤 Staging complete - ${Object.keys(staged.upload).length}/${files.length} files need to be uploaded.`,
      );
    }

    uploadRequest.files.forEach((f) => {
      session.log.debug(`📁 ${f.path} found ${f.md5}.`);
    });

    Object.entries(staged.cached).forEach(([k, f]) => {
      session.log.debug(`📦 ${k} ${f.path} cached.`);
    });

    Object.entries(staged.upload).forEach(([k, f]) => {
      session.log.debug(`🆙 ${k} ${f.path} to upload.`);
    });

    return { ...staged, files: files.filter((f) => staged.upload[f.md5]) };
  }

  throw new Error(`🤕 Failed to stage uploads: ${resp.status} ${resp.statusText}`);
}
