/**
 * Works API helpers for SCMS (v1).
 * Base URL derivation and work version metadata update.
 */

export type AttributesLike = {
  jobUrl?: string;
  statusUrl?: string;
  handshake?: string;
};

/**
 * Parse jobUrl or statusUrl to return the Works API v1 base URL (origin + /v1).
 * Used for work version updates and upload API calls.
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

/** Payload for PATCH work version metadata (metadata object only). */
export type WorkVersionMetadataPayload = {
  version?: number;
  files?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * PATCH work version metadata via the SCMS Works API.
 * PATCH ${baseUrl}/works/${workId}/versions/${workVersionId} with body { metadata }.
 * When loggingOnlyMode is true, skips the request and returns without error.
 */
export async function updateWorkVersionMetadata(
  workId: string,
  workVersionId: string,
  metadata: WorkVersionMetadataPayload,
  handshake: string,
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  loggingOnlyMode = false,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/works/${workId}/versions/${workVersionId}`;
  if (loggingOnlyMode) {
    console.log('[loggingOnlyMode] Skipping PATCH work version metadata', url);
    return;
  }
  const response = await fetchFn(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(handshake ? { Authorization: `Bearer ${handshake}` } : {}),
    },
    body: JSON.stringify({ metadata }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to update work version metadata: ${response.status} ${response.statusText}`,
    );
  }
}
