import type { ISession } from '../session/types.js';
import { postToJournals } from '../submissions/utils.js';
import { prepareUploadRequest } from './utils.js';

async function stageUploads(session: ISession) {
  const { files, uploadRequest } = await prepareUploadRequest(session);

  const resp = postToJournals(session, `uploads/stage`, uploadRequest, { method: 'POST' });

  //   const { json: uploadTargets } = await session.post<SiteUploadResponse>('/sites/upload', {
  //     ...uploadRequest,
  //   });

  return { ...uploads, stage: 'uploading' };
}
