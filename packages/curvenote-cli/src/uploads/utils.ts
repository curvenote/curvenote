import type { ISession } from '../session/types.js';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import mime from 'mime-types';
import { tic } from 'myst-cli-utils';
import path from 'node:path';
import type { FileInfo, SignedFileInfo, FromTo } from './types.js';
import cliProgress from 'cli-progress';
import pLimit from 'p-limit';
import type { SiteUploadRequest } from '@curvenote/blocks';

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

export function makeFileInfo(from: string, to: string): FileInfo {
  const content = fs.readFileSync(from).toString();
  const stats = fs.statSync(from);
  const md5 = createHash('md5').update(content).digest('hex');
  const contentType = mime.lookup(path.extname(from));
  return { from, to, md5, size: stats.size, contentType: contentType || '' };
}

export async function uploadFile(session: ISession, upload: SignedFileInfo) {
  const toc = tic();
  session.log.debug(`Starting upload of ${upload.from}`);
  const resumableSession = await session.fetch(upload.signedUrl, {
    method: 'POST',
    headers: {
      'x-goog-resumable': 'start',
      'content-type': upload.contentType,
    },
  });

  if (!resumableSession.ok) {
    session.log.error(`Failed to start upload for ${upload.from}`);
    session.log.error(`${resumableSession.status} ${resumableSession.statusText}`);
    throw new Error(`Failed to start upload for ${upload.from}`);
  }
  // Endpoint to which we should upload the file
  const location = resumableSession.headers.get('location') as string;

  // we are not resuming! if we want resumable uploads we need to implement
  // or use something other than fetch here that supports resuming
  const readStream = fs.createReadStream(upload.from);
  const uploadResponse = await session.fetch(location, {
    method: 'PUT',
    headers: {
      'Content-length': `${upload.size}`,
    },
    body: readStream,
  });

  if (!uploadResponse.ok) {
    session.log.error(`Upload failed for ${upload.from}`);
  }

  session.log.debug(toc(`Finished upload of ${upload.from} in %s.`));
}

export async function prepareUploadRequest(session: ISession) {
  const filesToUpload = listFolderContents(session, session.sitePath());
  session.log.info(`🔬 Preparing upload - found ${filesToUpload.length} files`);

  const files = filesToUpload.map(({ from, to }) => makeFileInfo(from, to));

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

export async function performFileUploads(
  session: ISession,
  filesWithUploadInfo: SignedFileInfo[],
  opts?: { ci?: boolean },
) {
  // Only upload N files at a time
  const limit = pLimit(10);
  const bar1 = opts?.ci
    ? undefined
    : new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  session.log.info(`☁️  Uploading ${filesWithUploadInfo.length} files`);
  bar1?.start(filesWithUploadInfo.length, 0);
  const toc = tic();
  let current = 0;
  await Promise.all(
    filesWithUploadInfo.map((file) =>
      limit(async () => {
        await uploadFile(session, file);
        current += 1;
        bar1?.update(current);
        if (opts?.ci && current % 5 == 0) {
          session.log.info(`☁️  Uploaded ${current} / ${filesWithUploadInfo.length} files`);
        }
      }),
    ),
  );
  bar1?.stop();
  session.log.info(toc(`☁️  Uploaded ${filesWithUploadInfo.length} files in %s.`));
}
