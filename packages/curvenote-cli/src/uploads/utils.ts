import type { ISession } from '../session/types.js';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import mime from 'mime-types';
import { tic } from 'myst-cli-utils';
import path from 'node:path';
import type { FileInfo, FileUpload, FromTo } from './types.js';
import cliProgress from 'cli-progress';
import pLimit from 'p-limit';
import type { SiteUploadRequest, SiteUploadResponse } from '@curvenote/blocks';

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

export async function uploadFile(session: ISession, upload: FileUpload) {
  const toc = tic();
  session.log.debug(`Starting upload of ${upload.from}`);
  const resumableSession = await session.fetch(upload.signedUrl, {
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
  session.log.info(`🔬 Preparing to upload ${filesToUpload.length} files`);

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
        await uploadFile(session, {
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
