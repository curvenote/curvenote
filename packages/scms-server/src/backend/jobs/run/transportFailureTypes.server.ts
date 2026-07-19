export type TransportFailureReason =
  | 'transport_exhausted'
  | 'invalid_handshake'
  | 'unknown_job_type';

export type HandleTransportFailureParams = {
  reason: TransportFailureReason | 'domain_failed' | 'stale_running';
  source: 'dead_letter' | 'on_failure_fallback';
  last_error?: string;
};
