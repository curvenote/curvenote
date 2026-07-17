/**
 * Works API helpers for SCMS (v1).
 * Base URL derivation and add-files-to-work-version.
 */

export type AttributesLike = {
  jobUrl?: string;
  statusUrl?: string;
  handshake?: string;
};

/**
 * Parse jobUrl or statusUrl to return the Works API v1 base URL (origin + /v1).
 * Used for work version file updates and upload API calls.
 */
export function getWorksApiBase(attributes: AttributesLike): string {
  const url = attributes.jobUrl ?? attributes.statusUrl ?? '';
  try {
    const u = new URL(url);
    return u.origin.endsWith('/v1') ? u.origin : `${u.origin}/v1`;
  } catch {
    return '';
  }
}

/**
 * File entry for adding to work version metadata.files.
 * Matches the API PATCH /files body (no signedUrl).
 */
export type WorkVersionFileEntry = {
  name: string;
  size: number;
  type: string;
  path: string;
  md5: string;
  uploadDate: string;
  slot: string;
  label?: string;
  order?: number;
};

/**
 * Add one or more file entries to work version metadata via the SCMS Works API.
 * PATCH ${baseUrl}/works/${workId}/versions/${workVersionId}/files with body { files }.
 * When loggingOnlyMode is true, skips the request and returns without error.
 */
export async function addFilesToWorkVersion(
  workId: string,
  workVersionId: string,
  files: WorkVersionFileEntry[],
  handshake: string,
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  loggingOnlyMode = false,
): Promise<void> {
  if (files.length === 0) return;
  const url = `${baseUrl.replace(/\/$/, '')}/works/${workId}/versions/${workVersionId}/files`;
  if (loggingOnlyMode) {
    console.log('[loggingOnlyMode] Skipping PATCH add files to work version', url, files.length);
    return;
  }
  const response = await fetchFn(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(handshake ? { Authorization: `Bearer ${handshake}` } : {}),
    },
    body: JSON.stringify({ files }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to add files to work version: ${response.status} ${response.statusText}`,
    );
  }
}

/**
 * Merge content labels into Work.contains and WorkVersion.contains via SCMS Works API.
 * PATCH ${baseUrl}/works/${workId}/versions/${workVersionId}/contains with body { contains }.
 */
export async function mergeContainsIntoWorkAndVersion(
  workId: string,
  workVersionId: string,
  contains: string[],
  handshake: string,
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  loggingOnlyMode = false,
): Promise<void> {
  if (contains.length === 0) return;
  const url = `${baseUrl.replace(/\/$/, '')}/works/${workId}/versions/${workVersionId}/contains`;
  if (loggingOnlyMode) {
    console.log('[loggingOnlyMode] Skipping PATCH merge contains', url, contains);
    return;
  }
  const response = await fetchFn(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(handshake ? { Authorization: `Bearer ${handshake}` } : {}),
    },
    body: JSON.stringify({ contains }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to merge contains on work version: ${response.status} ${response.statusText}`,
    );
  }
}
