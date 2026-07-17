/**
 * Upload API for SCMS: stage → resumable upload to signed URL → commit.
 * Uses types from @curvenote/common; implements resume/retry behavior aligned with CLI.
 */

import type { FileUploadResponse, UploadFileInfo, UploadStagingDTO } from '@curvenote/common';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

/** Stage request body (same shape as SiteUploadRequest). */
export type StageRequest = {
  files: UploadFileInfo[];
};

/** Re-export for callers that need the response type. */
export type { FileUploadResponse, UploadFileInfo, UploadStagingDTO };

/** Commit request body (uploads/commit). */
export type CommitRequest = {
  cdn: string;
  cdnKey: string;
  files: UploadFileInfo[];
};

export type UploadResult = {
  path: string;
  signedUrl?: string;
};

const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.inv': 'text/plain',
  '.map': 'application/json',
};

function getContentType(localPath: string): string {
  const ext = path.extname(localPath).toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
}

/** Relative file paths under a folder (recursive), POSIX-style (`a/b/c.json`). */
export function listFolderRelativePaths(
  from: string,
  to = '',
): { localPath: string; to: string }[] {
  const directory = fs.readdirSync(from);
  const files: string[] = [];
  const folders: string[] = [];
  for (const name of directory) {
    if (fs.statSync(path.join(from, name)).isDirectory()) folders.push(name);
    else files.push(name);
  }
  const outputFiles = files.map((f) => ({
    localPath: path.join(from, f),
    to: to ? `${to}/${f}` : f,
  }));
  const outputFolders = folders.flatMap((f) =>
    listFolderRelativePaths(path.join(from, f), to ? `${to}/${f}` : f),
  );
  return [...outputFiles, ...outputFolders];
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]);
    }
  });
  await Promise.all(workers);
}

/** File-derived metadata only (no paths). Caller supplies storage path when building the stage request. */
function makeFileInfo(localPath: string): {
  md5: string;
  size: number;
  contentType: string;
} {
  const content = fs.readFileSync(localPath);
  const md5 = createHash('md5').update(content).digest('hex');
  const stats = fs.statSync(localPath);
  const contentType = getContentType(localPath);
  return { md5, size: stats.size, contentType };
}

/**
 * POST to /uploads/stage. Returns staging DTO with signed URLs for upload_items.
 */
export async function stageUploadRequest(
  baseUrl: string,
  getAuthHeaders: () => Promise<Record<string, string>>,
  request: StageRequest,
  fetchFn: typeof fetch = fetch,
): Promise<UploadStagingDTO> {
  const url = `${baseUrl.replace(/\/$/, '')}/uploads/stage`;
  const headers = await getAuthHeaders();
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to stage uploads: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as UploadStagingDTO;
}

/**
 * POST to /uploads/commit after uploading to signed URLs.
 */
export async function commitUploads(
  baseUrl: string,
  getAuthHeaders: () => Promise<Record<string, string>>,
  data: CommitRequest,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/uploads/commit`;
  const headers = await getAuthHeaders();
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to commit uploads: ${response.status} ${response.statusText}`);
  }
}

/** Check if resumable upload at location is complete via PUT with empty body and Content-Range query. */
async function checkUploadCompleted(
  location: string,
  fetchFn: typeof fetch,
): Promise<{ complete: true } | { complete: false; range: string | null }> {
  const resp = await fetchFn(location, {
    method: 'PUT',
    headers: {
      'Content-Length': '0',
      'Content-Range': 'bytes */*',
    },
  });
  if (resp.ok) {
    return { complete: true };
  }
  if (resp.status === 308) {
    return { complete: false, range: resp.headers.get('range') };
  }
  throw new Error(`Unexpected status code ${resp.status} from upload check`);
}

/** Parse Range header from 308 response to get next byte and content range for resume. */
function parseRangeHeader(
  range: string,
  uploadSize: number,
): {
  nextByte: number;
  lastByte: number;
  contentLength: number;
  contentRange: string;
} {
  const [, end] = range.split('-');
  const nextByte = parseInt(end, 10) + 1;
  const lastByte = uploadSize - 1;
  const contentLength = uploadSize - nextByte;
  return {
    nextByte,
    lastByte,
    contentLength,
    contentRange: `bytes ${nextByte}-${lastByte}/${uploadSize}`,
  };
}

/** Perform a single PUT (full file or byte range). */
async function doTheUpload(
  location: string,
  localPath: string,
  size: number,
  contentType: string,
  fetchFn: typeof fetch,
  range?: { contentLength: number; contentRange: string; start: number; end: number },
): Promise<Response> {
  const isResume = range != null;
  const readStream = isResume
    ? fs.createReadStream(localPath, { start: range.start, end: range.end })
    : fs.createReadStream(localPath);
  const webStream = Readable.toWeb(readStream) as ReadableStream;
  const headers: Record<string, string> = {
    'Content-Length': `${range?.contentLength ?? size}`,
    'Content-Type': contentType,
  };
  if (range) {
    headers['Content-Range'] = range.contentRange;
  }
  return fetchFn(location, {
    method: 'PUT',
    headers,
    body: webStream,
    duplex: 'half',
  } as RequestInit);
}

/**
 * Start resumable upload (POST x-goog-resumable: start), then PUT file with retries and optional resume.
 * When resume is true, on 308 uses Content-Range to upload only remaining bytes and retries.
 */
async function performResumableUpload(
  signedUrl: string,
  localPath: string,
  contentType: string,
  size: number,
  getAuthHeaders: () => Promise<Record<string, string>>,
  fetchFn: typeof fetch,
  resume: boolean,
): Promise<void> {
  const headers = await getAuthHeaders();
  const startResponse = await fetchFn(signedUrl, {
    method: 'POST',
    headers: {
      'x-goog-resumable': 'start',
      'content-type': contentType,
      ...headers,
    },
  });
  if (!startResponse.ok) {
    throw new Error(
      `Failed to start resumable upload: ${startResponse.status} ${startResponse.statusText}`,
    );
  }
  const location = startResponse.headers.get('location');
  if (!location) {
    throw new Error('Resumable upload start did not return location');
  }

  const numberOfRetries = 3;
  const numberOfResumes = 10;

  for (let retries = 0; retries < numberOfRetries; retries++) {
    await doTheUpload(location, localPath, size, contentType, fetchFn);
    const check = await checkUploadCompleted(location, fetchFn);
    if (check.complete) {
      return;
    }
    if (check.range != null && resume) {
      let range: {
        contentLength: number;
        contentRange: string;
        start: number;
        end: number;
      } = (() => {
        const r = parseRangeHeader(check.range!, size);
        return {
          contentLength: r.contentLength,
          contentRange: r.contentRange,
          start: r.nextByte,
          end: r.lastByte,
        };
      })();
      for (let resumes = 0; resumes < numberOfResumes; resumes++) {
        await doTheUpload(location, localPath, size, contentType, fetchFn, range);
        const recheck = await checkUploadCompleted(location, fetchFn);
        if (recheck.complete) {
          return;
        }
        if (recheck.range != null) {
          const next = parseRangeHeader(recheck.range, size);
          range = {
            contentLength: next.contentLength,
            contentRange: next.contentRange,
            start: next.nextByte,
            end: next.lastByte,
          };
        }
      }
    }
  }

  throw new Error(`Failed to complete resumable upload after ${numberOfRetries} retries`);
}

/**
 * Simple PUT upload — single request to a signed URL (Azure SAS / S3 presigned).
 * No session init or resume logic needed.
 */
async function performSimplePutUpload(
  url: string,
  localPath: string,
  contentType: string,
  size: number,
  fetchFn: typeof fetch,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const readStream = fs.createReadStream(localPath);
  const webStream = Readable.toWeb(readStream) as ReadableStream;
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': `${size}`,
    ...(extraHeaders ?? {}),
  };
  const resp = await fetchFn(url, {
    method: 'PUT',
    headers,
    body: webStream,
    duplex: 'half',
  } as RequestInit);
  if (!resp.ok) {
    throw new Error(`Simple PUT upload failed: ${resp.status} ${resp.statusText}`);
  }
}

/**
 * Upload a single file to storage at {cdnKey}/{storagePath}: stage → upload → commit.
 * Requires cdn and cdnKey (e.g. from work version). Uses getAuthHeaders for API and upload start.
 *
 * Protocol-aware: uses the upload.protocol field from the staging response to decide
 * between GCS resumable upload and simple PUT (Azure SAS / S3 presigned).
 *
 * When resume is true, implements retry and resume-on-308 behavior (GCS only).
 * When loggingOnlyMode is true, skips all requests and returns a synthetic path without error.
 */
export async function uploadSingleFileToCdn(
  baseUrl: string,
  getAuthHeaders: () => Promise<Record<string, string>>,
  opts: {
    cdn: string;
    cdnKey: string;
    localPath: string;
    storagePath: string;
    resume?: boolean;
    loggingOnlyMode?: boolean;
  },
  fetchFn: typeof fetch = fetch,
): Promise<UploadResult> {
  const { cdn, cdnKey, localPath, storagePath, loggingOnlyMode = false, resume = false } = opts;
  if (!cdn?.trim() || !cdnKey?.trim()) {
    throw new Error('uploadSingleFileToCdn: cdn and cdnKey are required');
  }
  if (loggingOnlyMode) {
    console.log('[loggingOnlyMode] Skipping uploadSingleFileToCdn', { localPath, storagePath });
    return { path: `${cdnKey}/${storagePath}` };
  }
  const { md5, size, contentType } = makeFileInfo(localPath);
  const stageRequest: StageRequest = {
    files: [{ path: storagePath, content_type: contentType, md5, size }],
  };
  const staged = await stageUploadRequest(baseUrl, getAuthHeaders, stageRequest, fetchFn);
  const uploadItem = staged.upload_items.find((f) => f.md5 === md5);
  if (uploadItem) {
    const protocol = uploadItem.upload?.protocol ?? 'gcs-resumable';
    if (protocol === 'gcs-resumable') {
      await performResumableUpload(
        uploadItem.signed_url,
        localPath,
        contentType,
        size,
        getAuthHeaders,
        fetchFn,
        resume,
      );
    } else {
      // 'put' protocol — Azure SAS or S3 presigned URL
      await performSimplePutUpload(
        uploadItem.upload?.url ?? uploadItem.signed_url,
        localPath,
        contentType,
        size,
        fetchFn,
        uploadItem.upload?.headers,
      );
    }
  }
  const files: UploadFileInfo[] = [
    ...staged.cached_items,
    ...staged.upload_items.map((f) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit signed_url for commit payload
      const { signed_url, upload: _upload, ...rest } = f;
      return rest;
    }),
  ];
  await commitUploads(baseUrl, getAuthHeaders, { cdn, cdnKey, files }, fetchFn);
  const pathResult = `${cdnKey}/${storagePath}`;
  return { path: pathResult };
}

export type UploadFolderResult = {
  /** CDN key root used for commit (existing work version key). */
  cdnKey: string;
  /** Number of files committed under the key. */
  fileCount: number;
};

/**
 * Recursively upload a local folder to storage at {cdnKey}/{relativePath}.
 * Uses the same stage → upload → commit protocol as CLI site upload, but commits
 * into the caller-supplied existing cdnKey (does not mint a new key).
 */
export async function uploadFolderToCdn(
  baseUrl: string,
  getAuthHeaders: () => Promise<Record<string, string>>,
  opts: {
    cdn: string;
    cdnKey: string;
    localFolder: string;
    resume?: boolean;
    loggingOnlyMode?: boolean;
    concurrency?: number;
  },
  fetchFn: typeof fetch = fetch,
): Promise<UploadFolderResult> {
  const {
    cdn,
    cdnKey,
    localFolder,
    loggingOnlyMode = false,
    resume = false,
    concurrency = 10,
  } = opts;
  if (!cdn?.trim() || !cdnKey?.trim()) {
    throw new Error('uploadFolderToCdn: cdn and cdnKey are required');
  }
  const entries = listFolderRelativePaths(localFolder);
  if (entries.length === 0) {
    throw new Error(`uploadFolderToCdn: no files found in ${localFolder}`);
  }
  if (loggingOnlyMode) {
    console.log('[loggingOnlyMode] Skipping uploadFolderToCdn', {
      localFolder,
      fileCount: entries.length,
      cdnKey,
    });
    return { cdnKey, fileCount: entries.length };
  }

  const prepared = entries.map(({ localPath, to }) => {
    const { md5, size, contentType } = makeFileInfo(localPath);
    return { localPath, to, md5, size, contentType };
  });
  const stageRequest: StageRequest = {
    files: prepared.map(({ to, md5, size, contentType }) => ({
      path: to,
      content_type: contentType,
      md5,
      size,
    })),
  };
  const staged = await stageUploadRequest(baseUrl, getAuthHeaders, stageRequest, fetchFn);

  const byMd5 = new Map(prepared.map((f) => [f.md5, f]));
  await mapWithConcurrency(staged.upload_items, concurrency, async (uploadItem) => {
    const local = byMd5.get(uploadItem.md5);
    if (!local) {
      throw new Error(`uploadFolderToCdn: staged md5 not found locally: ${uploadItem.md5}`);
    }
    const protocol = uploadItem.upload?.protocol ?? 'gcs-resumable';
    if (protocol === 'gcs-resumable') {
      await performResumableUpload(
        uploadItem.signed_url,
        local.localPath,
        local.contentType,
        local.size,
        getAuthHeaders,
        fetchFn,
        resume,
      );
    } else {
      await performSimplePutUpload(
        uploadItem.upload?.url ?? uploadItem.signed_url,
        local.localPath,
        local.contentType,
        local.size,
        fetchFn,
        uploadItem.upload?.headers,
      );
    }
  });

  const files: UploadFileInfo[] = [
    ...staged.cached_items,
    ...staged.upload_items.map((f) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit signed_url for commit payload
      const { signed_url, upload: _upload, ...rest } = f;
      return rest;
    }),
  ];
  await commitUploads(baseUrl, getAuthHeaders, { cdn, cdnKey, files }, fetchFn);
  return { cdnKey, fileCount: files.length };
}
