/**
 * Works API helpers for the converter.
 * getWorksApiBase: derive v1 base URL from job/status URL.
 * uploadPdfToStorage: upload PDF via CLI upload API (stage → upload → commit with existing cdnKey).
 * updateWorkVersionMetadata: stub (log and return placeholder).
 */

import type { WorkVersionMetadataPayload } from './payload.js';
import { upload as cliUpload } from '@curvenote/cli';
import type { ISession } from '@curvenote/cli';

export type AttributesLike = {
  jobUrl?: string;
  statusUrl?: string;
  handshake?: string;
};

/**
 * Parse jobUrl or statusUrl to return the Works API v1 base URL (origin + /v1).
 * Used for update (and future upload) calls.
 */
export function getWorksApiBase(attributes: AttributesLike): string {
  const url = attributes.jobUrl ?? attributes.statusUrl ?? '';
  try {
    const u = new URL(url);
    const base = `${u.origin}${u.pathname.startsWith('/v1') ? '' : ''}`;
    return base.endsWith('/v1') ? base : `${u.origin}/v1`;
  } catch {
    return '';
  }
}

/** Result from upload: path (and optional signedUrl for downstream). */
export type UploadResult = {
  path: string;
  signedUrl?: string;
};

const noop = (): void => {};
/** Minimal log for CLI upload calls (no-op to avoid noise; use console in dev if needed). */
const minimalLog = { debug: noop, info: noop, error: noop };

/**
 * Create a minimal session-like object for CLI upload APIs. Implements only the surface
 * used by stage/upload/commit: config.apiUrl, getHeaders(), fetch, log.
 */
export function createUploadSession(
  apiUrl: string,
  authHeaders: () => Promise<Record<string, string>>,
  fetchFn: typeof fetch = fetch,
): ISession {
  return {
    config: { apiUrl } as ISession['config'],
    getHeaders: authHeaders,
    fetch: (url: string | URL | Request, init?: RequestInit) => fetchFn(url, init),
    log: minimalLog,
  } as unknown as ISession;
}

/**
 * Upload the local PDF to storage at {cdnKey}/export/{exportFilename} using the
 * upload API (stage → upload to signed URL → commit with existing cdnKey).
 * Requires cdn and cdnKey (e.g. from workVersion); uses handshake for Authorization.
 */
export async function uploadPdfToStorage(
  localPdfPath: string,
  cdn: string | null,
  cdnKey: string | null,
  handshake: string,
  baseUrl: string,
  exportFilename: string = 'document.pdf',
): Promise<UploadResult> {
  if (!cdn?.trim() || !cdnKey?.trim()) {
    throw new Error(
      'uploadPdfToStorage: cdn and cdnKey are required to upload to an existing location',
    );
  }
  const storagePath = `export/${exportFilename}`;
  const session = createUploadSession(baseUrl, () =>
    Promise.resolve(
      handshake ? { Authorization: `Bearer ${handshake}` } : ({} as Record<string, string>),
    ),
  );
  const uploadSingleFileToCdn = (
    cliUpload as unknown as {
      uploadSingleFileToCdn: (
        s: ISession,
        o: {
          cdn: string;
          cdnKey: string;
          localPath: string;
          storagePath: string;
          resume?: boolean;
        },
      ) => Promise<{ path: string; cdnKey: string }>;
    }
  ).uploadSingleFileToCdn;
  const result = await uploadSingleFileToCdn(session, {
    cdn,
    cdnKey,
    localPath: localPdfPath,
    storagePath,
    resume: false,
  });
  return { path: result.path };
}

/**
 * Stub: log and return. Real implementation: PATCH Works API
 * (e.g. PATCH ${baseUrl}/works/${workId}/versions/${workVersionId})
 * with body { metadata } and Authorization: Bearer ${handshake}.
 */
export async function updateWorkVersionMetadata(
  workId: string,
  workVersionId: string,
  metadata: WorkVersionMetadataPayload,
  handshake: string,
  baseUrl: string,
): Promise<void> {
  console.log('[stub] updateWorkVersionMetadata', {
    workId,
    workVersionId,
    baseUrl,
    handshakePresent: !!handshake,
    metadataKeys: Object.keys(metadata),
  });
}
