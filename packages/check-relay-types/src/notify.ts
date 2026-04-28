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
 * Plugin-local names for **`POST …/trigger-stage`** request bodies only (relay routing).
 * Not used on notify envelopes — distinguish workflow steps via {@link NotifyEventName}.
 */
export type ProcessingPhaseName = string;

/** Canonical similarity top match (snake_case wire — vendor-neutral). */
export interface SimilarityTopMatchWire {
  percentage: number;
  submission_id?: string;
  source_type: string;
  matched_word_count_total: number;
  submitted_date?: string;
  institution_name?: string;
  name: string;
}

/**
 * Canonical similarity report snapshot (snake_case wire).
 * Maps any vendor’s similarity outcome into one SCMS-facing shape.
 */
export interface SimilarityReportWire {
  submission_id: string;
  overall_match_percentage: number;
  internet_match_percentage?: number | null;
  publication_match_percentage?: number | null;
  submitted_works_match_percentage?: number | null;
  status: 'PROCESSING' | 'COMPLETE';
  time_requested: string;
  time_generated?: string;
  top_source_largest_matched_word_count?: number;
  top_matches?: SimilarityTopMatchWire[];
}

export interface ProcessingPhasePayloadBase {
  /**
   * Similarity report when this phase completes with similarity data (preferred over legacy blobs).
   */
  similarity_report?: SimilarityReportWire;
  /**
   * @deprecated Prefer {@link similarity_report}. Raw vendor JSON must not be required by SCMS.
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
