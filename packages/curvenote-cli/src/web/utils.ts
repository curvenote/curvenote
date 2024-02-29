import type { ISession } from '../session/types.js';
import { performFileUploads, prepareUploadRequest } from '../uploads/index.js';
import { addOxaTransformersToOpts } from '../utils/index.js';
import { tic } from 'myst-cli-utils';
import type { SiteDeployRequest, SiteUploadResponse } from '@curvenote/blocks';

export const siteCommandWrapper =
  (
    siteCommand: (session: ISession, opts: Record<string, any>) => Promise<any>,
    defaultOptions: Record<string, any>,
  ) =>
  async (session: ISession, opts: Record<string, any>) => {
    await siteCommand(session, addOxaTransformersToOpts(session, { ...defaultOptions, ...opts }));
  };

/**
 * Upload content to the (private) staging bucket
 *
 * @param session
 * @param opts
 * @returns cdnkey and filepaths for deployment
 */
export async function uploadContent(session: ISession, opts?: { ci?: boolean; resume?: boolean }) {
  const { files, uploadRequest } = await prepareUploadRequest(session);
  const { json: uploadInfo } = await session.post<SiteUploadResponse>('/sites/upload', {
    ...uploadRequest,
  });

  const filesToUpload = files.map((file) => {
    const upload = uploadInfo.files[file.to];
    return {
      from: file.from,
      to: upload.path,
      md5: file.md5,
      size: file.size,
      contentType: file.contentType,
      signedUrl: upload.signed_url,
    };
  });

  await performFileUploads(session, filesToUpload, opts);
  const cdnKey = uploadInfo.id;

  return { cdnKey, filepaths: files.map(({ to }) => ({ path: to })) };
}

/**
 * Deploy content to the public/private CDN based on the usePublicCdn argument
 *
 * @param session
 * @param usePublicCdn whether to deploy to the public CDN or default private CDN
 * @param cdnKey
 * @param filepaths
 * @returns cdnkey
 */
export async function deployContent(
  session: ISession,
  privacy: { public: boolean },
  cdnKey: string,
  filepaths: { path: string }[],
) {
  const toc = tic();
  const deployRequest: SiteDeployRequest = {
    public: privacy.public,
    id: cdnKey,
    files: filepaths,
  };
  const deployResp = await session.post('/sites/deploy', deployRequest);

  if (deployResp.ok) {
    session.log.info(toc(`🚀 Deployed ${filepaths.length} files in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
  } else {
    throw new Error('Deployment failed: Please contact support@curvenote.com!');
  }
  return cdnKey;
}

/**
 * Perform PRIVATE CDN upload and deployment
 *
 * @param session
 * @param opts
 * @returns cdnkey
 */
export async function uploadContentAndDeployToPrivateCdn(
  session: ISession,
  opts?: { ci?: boolean },
) {
  const { cdnKey, filepaths } = await uploadContent(session, opts);
  // TODO bespoke private CDN
  return await deployContent(session, { public: false }, cdnKey, filepaths);
}

/**
 * Perform PUBLIC CDN upload and deployment
 *
 * @param session
 * @param opts
 * @returns cdnkey
 */
export async function uploadContentAndDeployToPublicCdn(
  session: ISession,
  opts?: { ci?: boolean; resume?: boolean },
) {
  const { cdnKey, filepaths } = await uploadContent(session, opts);
  return await deployContent(session, { public: true }, cdnKey, filepaths);
}
