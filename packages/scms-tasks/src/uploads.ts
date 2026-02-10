/**
 * Upload API for SCMS: stage → resumable upload to signed URL → commit.
 * No dependency on @curvenote/cli; uses fetch and node:fs.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

/** File entry for stage request (path, content_type, md5, size). */
export type StageFileEntry = {
  path: string;
  content_type: string;
  md5: string;
  size: number;
};

/** Stage request body. */
export type StageRequest = {
  files: StageFileEntry[];
};

/** Item in stage response upload_items / cached_items. */
export type UploadFileInfo = {
  path: string;
  content_type: string;
  md5: string;
  size: number;
};

export type FileUploadResponse = UploadFileInfo & {
  signed_url: string;
};

/** Stage response (uploads/stage). */
export type UploadStagingDTO = {
  cdnKey: string;
  cached_items: UploadFileInfo[];
  upload_items: FileUploadResponse[];
};

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
};

function getContentType(localPath: string): string {
  const ext = path.extname(localPath).toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
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

/**
 * Start resumable upload (POST x-goog-resumable: start), then PUT file to location.
 * Uses getAuthHeaders for the initial POST; signed URL may not need auth for PUT (GCS).
 */
async function performResumableUpload(
  signedUrl: string,
  localPath: string,
  contentType: string,
  size: number,
  getAuthHeaders: () => Promise<Record<string, string>>,
  fetchFn: typeof fetch = fetch,
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
  const nodeStream = fs.createReadStream(localPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  const putResponse = await fetchFn(location, {
    method: 'PUT',
    headers: {
      'Content-Length': `${size}`,
      'Content-Type': contentType,
    },
    body: webStream,
  });
  if (!putResponse.ok) {
    throw new Error(`Failed to upload file: ${putResponse.status} ${putResponse.statusText}`);
  }
}

/**
 * Upload a single file to storage at {cdnKey}/{storagePath}: stage → upload → commit.
 * Requires cdn and cdnKey (e.g. from work version). Uses getAuthHeaders for API and upload start.
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
  const { cdn, cdnKey, localPath, storagePath, loggingOnlyMode = false } = opts;
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
    await performResumableUpload(
      uploadItem.signed_url,
      localPath,
      contentType,
      size,
      getAuthHeaders,
      fetchFn,
    );
  }
  const files: UploadFileInfo[] = [
    ...staged.cached_items,
    ...staged.upload_items.map((f) => {
      const { signed_url: _s, ...rest } = f;
      return rest;
    }),
  ];
  await commitUploads(baseUrl, getAuthHeaders, { cdn, cdnKey, files }, fetchFn);
  const pathResult = `${cdnKey}/${storagePath}`;
  return { path: pathResult };
}
