/**
 * Relay → SCMS notify webhook contract (client-facing).
 *
 * Goals:
 * - standardized across all plugins
 * - explicit `event` names with event-specific payloads
 * - plugin-specific additions go under `metadata`
 * - wire keys are snake_case
 *
 * Coarse `UPLOAD_*` events describe the submission / ingest stage at the provider (not the
 * whole multi-phase workflow). Later steps use `PROCESSING_PHASE_*` and `REPORT_GENERATION_*`.
 */

export type NotifyEventName =
  | 'UPLOAD_PENDING'
  | 'UPLOAD_ACCEPTED'
  | 'UPLOAD_COMPLETE'
  | 'UPLOAD_FAILED'
  | 'PROCESSING_PHASE_STARTED'
  | 'PROCESSING_PHASE_COMPLETE'
  | 'PROCESSING_PHASE_FAILED'
  | 'REPORT_GENERATION_STARTED'
  | 'REPORT_GENERATION_COMPLETE'
  | 'REPORT_GENERATION_FAILED';

/**
 * Common envelope sent by checks-relay to the SCMS `notify_url`.
 *
 * `metadata` is reserved for plugin-specific additions that do not belong in standardized fields.
 */
export interface RelayNotifyEnvelopeBase<E extends NotifyEventName, P> {
  /** Event name (standardized across all plugins). */
  event: E;
  /** Provider-side identifier for this check (e.g. external submission id). */
  check_id: string;
  /** Client-provided idempotency key; for SCMS this is typically the check_service_run_id. */
  client_id: string;
  /** Service/plugin name (e.g. `checker`). */
  service_name: string;
  /** When this envelope was emitted (ISO-8601). */
  occurred_at: string;
  /**
   * Standardized payload for this event.
   * Must be JSON-serializable and use snake_case keys.
   */
  payload: P;
  /**
   * Plugin-specific metadata (optional).
   * Use this for provider-specific fields that SCMS does not need to understand to operate.
   */
  metadata?: Record<string, unknown>;
}

/** Provider is still ingesting or processing the submission (coarse / generic fallback). */
export type UploadPendingPayload = {
  upload_status: 'PENDING';
};

/** Provider accepted the manuscript / submission (e.g. submission-complete webhook without error). */
export type UploadAcceptedPayload = {
  upload_status: 'ACCEPTED';
};

/** Provider signaled completion for this status update (generic fallback when not submission-specific). */
export type UploadCompletePayload = {
  upload_status: 'COMPLETE';
};

/** Submission / ingest failed at the provider (coarse; scoped to upload lane, not report phases). */
export type UploadFailedPayload = {
  upload_status: 'ERROR';
  error_code?: string;
  error_message?: string;
};

/**
 * Processing phases are plugin-dependent and may repeat.
 * Examples: "upload_and_similarity", "queue_similarity", "fetch_report".
 */
export type ProcessingPhaseName = string;

export interface ProcessingPhasePayloadBase {
  /** Name of the processing phase (plugin-defined, stable string). */
  phase: ProcessingPhaseName;
  /**
   * Provider payload or a safely-redacted subset relevant to this phase.
   * Optional; include when it helps debugging without leaking secrets.
   */
  provider_payload?: Record<string, unknown>;
  /**
   * Optional report identifiers/URLs discovered during this phase.
   * Use for cases like similarity completion where a report id/url becomes available.
   */
  report?: {
    report_id?: string;
    report_url?: string;
    report_pdf_url?: string;
    mime_type?: string;
  };
}

export type ProcessingPhaseStartedPayload = ProcessingPhasePayloadBase & {
  started: true;
};

export type ProcessingPhaseCompletePayload = ProcessingPhasePayloadBase & {
  completed: true;
};

export type ProcessingPhaseFailedPayload = ProcessingPhasePayloadBase & {
  failed: true;
  error_code?: string;
  error_message?: string;
};

export type ReportGenerationStartedPayload = {
  status: 'PROCESSING';
  report?: {
    report_id?: string;
    report_url?: string;
    report_pdf_url?: string;
    mime_type?: string;
  };
};

export type ReportGenerationCompletePayload = {
  status: 'SUCCESS';
  report?: {
    report_id?: string;
    report_url?: string;
    report_pdf_url?: string;
    mime_type?: string;
  };
};

export type ReportGenerationFailedPayload = {
  status: 'FAILED';
  error_code?: string;
  error_message?: string;
};

export type RelayNotifyEnvelope =
  | RelayNotifyEnvelopeBase<'UPLOAD_PENDING', UploadPendingPayload>
  | RelayNotifyEnvelopeBase<'UPLOAD_ACCEPTED', UploadAcceptedPayload>
  | RelayNotifyEnvelopeBase<'UPLOAD_COMPLETE', UploadCompletePayload>
  | RelayNotifyEnvelopeBase<'UPLOAD_FAILED', UploadFailedPayload>
  | RelayNotifyEnvelopeBase<'PROCESSING_PHASE_STARTED', ProcessingPhaseStartedPayload>
  | RelayNotifyEnvelopeBase<'PROCESSING_PHASE_COMPLETE', ProcessingPhaseCompletePayload>
  | RelayNotifyEnvelopeBase<'PROCESSING_PHASE_FAILED', ProcessingPhaseFailedPayload>
  | RelayNotifyEnvelopeBase<'REPORT_GENERATION_STARTED', ReportGenerationStartedPayload>
  | RelayNotifyEnvelopeBase<'REPORT_GENERATION_COMPLETE', ReportGenerationCompletePayload>
  | RelayNotifyEnvelopeBase<'REPORT_GENERATION_FAILED', ReportGenerationFailedPayload>;
