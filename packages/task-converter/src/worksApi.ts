/**
 * Works API helpers for the converter.
 * getWorksApiBase: derive v1 base URL from job/status URL.
 * uploadPdfToStorage, updateWorkVersionMetadata: stubs (log and return placeholders).
 */

import type { WorkVersionMetadataPayload } from './payload.js';

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

/** Result from upload stub: path (and optional signedUrl for downstream). */
export type UploadResult = {
  path: string;
  signedUrl?: string;
};

/**
 * Stub: log and return placeholder path for the uploaded PDF.
 * Real implementation: upload API or GCS with service account under version cdn/cdn_key.
 * exportFilename defaults to 'document.pdf'.
 */
export async function uploadPdfToStorage(
  _localPdfPath: string,
  _cdn: string | null,
  cdnKey: string | null,
  _handshake: string,
  _baseUrl: string,
  exportFilename: string = 'document.pdf',
): Promise<UploadResult> {
  const storagePath = cdnKey ? `${cdnKey}/export/${exportFilename}` : `export/${exportFilename}`;
  console.log('[stub] uploadPdfToStorage: would upload to', storagePath);
  return { path: storagePath };
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
