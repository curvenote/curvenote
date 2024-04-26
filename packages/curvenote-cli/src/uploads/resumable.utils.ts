import type { ISession } from '../session/types.js';
import fs from 'node:fs';
import { tic } from 'myst-cli-utils';
import type { SignedFileInfo } from './types.js';
import chalk from 'chalk';

async function checkUploadCompleted(session: ISession, location: string) {
  const resp = await session.fetch(location, {
    method: 'PUT',
    headers: {
      'Content-length': '0',
      'Content-Range': 'bytes */*',
    },
  });
  if (resp.ok) {
    return { complete: true };
  } else if (resp.status === 308) {
    return { complete: false, range: resp.headers.get('range') };
  } else {
    throw new Error(`Unexpected status code ${resp.status} from upload check`);
  }
}

async function doTheUpload(
  session: ISession,
  location: string,
  upload: SignedFileInfo,
  contentLength?: number,
  contentRange?: string,
) {
  try {
    const readStream = fs.createReadStream(upload.from);
    const headers: Record<string, string> = {
      'Content-length': contentLength ? `${contentLength}` : `${upload.size}`,
    };
    if (contentRange) {
      headers['Content-Range'] = contentRange;
    }
    const resp = session.fetch(location, {
      method: 'PUT',
      headers,
      body: readStream,
    });
    return resp;
  } catch (e) {
    // eat error
  }
}

function parseRangeHeader(range: string, uploadSize: number) {
  const [, end] = range.split('-');
  const nextByte = parseInt(end) + 1;
  const lastByte = uploadSize - 1;
  const contentLength = uploadSize - nextByte;
  const totalSize = uploadSize;

  return {
    nextByte,
    lastByte,
    contentLength,
    totalSize: uploadSize,
    contentRange: `bytes ${nextByte}-${lastByte}/${totalSize}`,
  };
}

export async function uploadFileWithOptionalResume(
  session: ISession,
  upload: SignedFileInfo,
  opts?: { resume?: boolean },
) {
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

  let retries = 0;
  const numberOfRetries = 3;
  const numberOfResumes = 10;
  for (; retries < numberOfRetries; retries++) {
    await doTheUpload(session, location, upload);
    const initialCheckResponse = await checkUploadCompleted(session, location);
    if (initialCheckResponse.complete) {
      break;
    }
    if (initialCheckResponse.range && opts?.resume) {
      // we managed a partial upload, we can try to resume
      const { contentLength, contentRange } = parseRangeHeader(
        initialCheckResponse.range,
        upload.size,
      );
      for (let resumes = 0; resumes < numberOfResumes; resumes++) {
        await doTheUpload(session, location, upload, contentLength, contentRange);
        const checkResponse = await checkUploadCompleted(session, location);
        if (checkResponse.complete) {
          session.log.debug(
            toc(
              chalk.red(
                `Finished upload of ${upload.from} in %s. (${retries} retries, ${resumes} resumes)`,
              ),
            ),
          );
          return;
        }
      }
    }
  }

  session.log.debug(
    toc(`Finished upload of ${upload.from} in %s.` + (retries > 0) ? ` (${retries} retries)` : ''),
  );
}
