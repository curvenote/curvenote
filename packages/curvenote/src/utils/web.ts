import type { ISession } from '../session/types.js';
import { createHash } from 'node:crypto';
import cliProgress from 'cli-progress';
import fs from 'node:fs';
import mime from 'mime-types';
import { tic } from 'myst-cli-utils';
import type { Logger } from 'myst-cli-utils';
import fetch from 'node-fetch';
import path from 'node:path';
import pLimit from 'p-limit';
import type { SiteDeployRequest, SiteUploadRequest, SiteUploadResponse } from '@curvenote/blocks';
import { addOxaTransformersToOpts } from '../utils/index.js';
import type { FileInfo, FileUpload, FromTo } from './types.js';

export const siteCommandWrapper =
  (
    siteCommand: (session: ISession, opts: Record<string, any>) => Promise<any>,
    defaultOptions: Record<string, any>,
  ) =>
  async (session: ISession, opts: Record<string, any>) => {
    await siteCommand(session, addOxaTransformersToOpts(session, { ...defaultOptions, ...opts }));
  };

export function listFolderContents(session: ISession, from: string, to = ''): FromTo[] {
  const directory = fs.readdirSync(from);
  const files: string[] = [];
  const folders: string[] = [];
  directory.forEach((f) => {
    if (fs.statSync(path.join(from, f)).isDirectory()) {
      folders.push(f);
    } else {
      files.push(f);
    }
  });
  const outputFiles: FromTo[] = files.map((f) => ({
    from: path.join(from, f),
    to: to ? `${to}/${f}` : f,
  }));
  const outputFolders: FromTo[] = folders
    .map((f) => listFolderContents(session, path.join(from, f), to ? `${to}/${f}` : f))
    .flat();
  return [...outputFiles, ...outputFolders];
}

export async function prepareFileForUpload(from: string, to: string): Promise<FileInfo> {
  const content = fs.readFileSync(from).toString();
  const stats = fs.statSync(from);
  const md5 = createHash('md5').update(content).digest('hex');
  const contentType = mime.lookup(path.extname(from));
  return { from, to, md5, size: stats.size, contentType: contentType || '' };
}

export async function uploadFile(log: Logger, upload: FileUpload) {
  const toc = tic();
  log.debug(`Starting upload of ${upload.from}`);
  const resumableSession = await fetch(upload.signedUrl, {
    method: 'POST',
    headers: {
      'x-goog-resumable': 'start',
      'content-type': upload.contentType,
    },
  });
  // Endpoint to which we should upload the file
  const location = resumableSession.headers.get('location') as string;

  // we are not resuming! if we want resumable uploads we need to implement
  // or use something other than fetch here that supports resuming
  const readStream = fs.createReadStream(upload.from);
  const uploadResponse = await fetch(location, {
    method: 'PUT',
    headers: {
      'Content-length': `${upload.size}`,
    },
    body: readStream,
  });

  if (!uploadResponse.ok) {
    log.error(`Upload failed for ${upload.from}`);
  }

  log.debug(toc(`Finished upload of ${upload.from} in %s.`));
}

export async function prepareUploadRequest(session: ISession) {
  const filesToUpload = listFolderContents(session, session.sitePath());
  session.log.info(`🔬 Preparing to upload ${filesToUpload.length} files`);

  const files = await Promise.all(
    filesToUpload.map(({ from, to }) => prepareFileForUpload(from, to)),
  );

  const uploadRequest: SiteUploadRequest = {
    files: files.map(({ md5, size, contentType, to }) => ({
      path: to,
      content_type: contentType,
      md5,
      size,
    })),
  };

  return { files, uploadRequest };
}

export async function processUpload(
  session: ISession,
  files: FileInfo[],
  uploadTargets: SiteUploadResponse,
  opts?: { ci?: boolean },
) {
  // Only upload N files at a time
  const limit = pLimit(10);
  const bar1 = opts?.ci
    ? undefined
    : new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  session.log.info(`☁️  Uploading ${files.length} files`);
  bar1?.start(files.length, 0);
  const toc = tic();
  let current = 0;
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        const upload = uploadTargets.files[file.to];
        await uploadFile(session.log, {
          bucket: uploadTargets.bucket,
          from: file.from,
          to: upload.path,
          md5: file.md5,
          size: file.size,
          contentType: file.contentType,
          signedUrl: upload.signed_url,
        });
        current += 1;
        bar1?.update(current);
        if (opts?.ci && current % 5 == 0) {
          session.log.info(`☁️  Uploaded ${current} / ${files.length} files`);
        }
      }),
    ),
  );
  bar1?.stop();
  session.log.info(toc(`☁️  Uploaded ${files.length} files in %s.`));

  const cdnKey = uploadTargets.id;
  return { cdnKey };
}

/**
 * Upload content to the (private) staging bucket
 *
 * @param session
 * @param opts
 * @returns cdnkey and filepaths for deployment
 */
export async function uploadContent(session: ISession, opts?: { ci?: boolean }) {
  const { files, uploadRequest } = await prepareUploadRequest(session);
  const { json: uploadTargets } = await session.post<SiteUploadResponse>('/sites/upload', {
    ...uploadRequest,
  });
  const { cdnKey } = await processUpload(session, files, uploadTargets, opts);
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
  opts?: { ci?: boolean },
) {
  const { cdnKey, filepaths } = await uploadContent(session, opts);
  return await deployContent(session, { public: true }, cdnKey, filepaths);
}
