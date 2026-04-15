/**
 * Relay upload HTTP contract and the payload the relay passes to `ServicePlugin.upload`.
 *
 * - {@link RelayUploadRequestBody} matches the client JSON body for
 *   `POST /api/v1/services/:serviceName/instances/:instanceId/upload` after `credentials` is removed.
 * - {@link PluginUploadPayload} is the same shape normalized (metadata defaults to `{}`).
 */

export interface SubmitManuscriptFile {
  url: string;
  filename: string;
}

/**
 * POST …/services/:serviceName/instances/:instanceId/upload JSON body after `credentials` is split off.
 * `metadata` is freeform; each plugin validates and interprets it.
 */
export interface RelayUploadRequestBody {
  clientId: string;
  files: SubmitManuscriptFile[];
  notifyUrl: string;
  /** Plugin-specific options (e.g. owner/title). Optional; defaults to `{}` before `upload`. */
  metadata?: Record<string, unknown>;
}

/**
 * Payload passed to `ServicePlugin.upload`. The relay normalizes `metadata` to a
 * non-optional `Record` before calling the plugin. `instanceId` is the URL path segment.
 */
export interface PluginUploadPayload extends RelayUploadRequestBody {
  instanceId: string;
  metadata: Record<string, unknown>;
}

/** @deprecated Use {@link SubmitManuscriptFile}. */
export type FileReference = SubmitManuscriptFile;
