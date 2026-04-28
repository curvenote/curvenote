import type { RelayNotifyEnvelope } from './notify.js';

/**
 * Response body for `POST …/check/:externalId/status`.
 *
 * Uses the **same JSON objects** relay would POST to the client `notify_url`, so SCMS can apply
 * identical handlers as ingest notify — possibly empty when there is nothing new to report.
 */
export interface RelayCheckStatusResponse {
  envelopes: RelayNotifyEnvelope[];
}
