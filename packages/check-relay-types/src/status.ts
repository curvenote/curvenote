import type { RelayNotifyEnvelope } from './notify.js';

export interface RelayRecoveryHint {
  /** Provider-neutral pipeline phase that can be recovered. */
  phase: string;
  /** Relay operation SCMS should call after acquiring its local guard. */
  action: 'start-report-generation';
  /** Provider-neutral reason for the recovery hint. */
  reason: 'missing' | 'not-ready';
  /** True when retrying this action is expected to be safe after client-side dedupe. */
  recoverable: true;
}

/**
 * Response body for `POST …/check/:externalId/status`.
 *
 * Uses the **same JSON objects** relay would POST to the client `notify_url`, so SCMS can apply
 * identical handlers as ingest notify — possibly empty when there is nothing new to report.
 */
export interface RelayCheckStatusResponse {
  envelopes: RelayNotifyEnvelope[];
  recovery?: RelayRecoveryHint;
}
