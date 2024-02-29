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
import { uploadFileWithOptionalResume } from './resumable.utils.js';

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

export async function prepareUploadRequest(session: ISession) {
  const filesToUpload = listFolderContents(session, session.sitePath());
  session.log.info(`🔬 Preparing to upload - found ${filesToUpload.length} files`);

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
  opts?: { ci?: boolean; resume?: boolean },
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
        await uploadFileWithOptionalResume(session, file, opts);
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
