/**
 * Plugin interface types (service-plugin implementers).
 *
 * These are intentionally separated from client-facing API/notify contracts.
 */

import type { PluginUploadPayload, SubmitManuscriptFile } from './relay.js';

// ── JSON ──

/** JSON-serializable value (for responses that round-trip through `JSON.stringify`). */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

// ── Core plugin result types ──

/**
 * Canonical status strings for **`PluginOperationResult`** and related plugin outcomes
 * (upload, configure, terms, check-scoped calls, etc.).
 */
export type PluginStatus = 'submitted' | 'processing' | 'completed' | 'failed' | 'error';

/**
 * Check / ingest lifecycle — **identical to {@link PluginStatus}**.
 * Use in **`WebhookParseResult`** (and anywhere you want to signal “this status describes a check”).
 */
export type CheckStatus = PluginStatus;

/**
 * Standard JSON response shape for POST integration routes (except instance-level status passthrough).
 *
 * Use the type parameter when a plugin wants a precise `result` payload. Error responses often use a
 * different `result` shape than success; model that as a union `T`.
 */
export interface PluginOperationResult<T = unknown> {
  status: PluginStatus;
  message?: string;
  result: T | null;
}

/**
 * `getInstanceStatus()` returns a JSON object (e.g. provider feature flags).
 */
export type InstanceStatusResult = { readonly [key: string]: JsonValue };

export type PluginReportResult =
  | { kind: 'json'; response: PluginOperationResult }
  | { kind: 'binary'; body: Uint8Array; contentType: string };

// ── Service discovery (manifest is produced by plugin; consumed by clients) ──

export interface ServiceManifest {
  name: string;
  title: string;
  description: string;
  version: string;
  /** Absolute URL, or root-relative path on the relay (plugin static files: `/api/assets/<name>/...`). */
  logo: string;
  /** Plugin-defined service metadata (capabilities, UI hints, etc). */
  metadata: Record<string, unknown>;
}

// ── Webhooks ──

/**
 * Thrown by plugins when the provider webhook signature does not verify.
 * The relay maps this to **401** on ingest (not 500).
 */
export class WebhookSignatureInvalidError extends Error {
  override readonly name = 'WebhookSignatureInvalidError';

  constructor(message = 'Invalid webhook signature') {
    super(message);
  }
}

/**
 * Inbound provider webhook before JSON parsing. Used only with {@link ServicePlugin.verifyWebhook}.
 */
export interface WebhookVerifyRequest {
  headers: Record<string, string>;
  /** Raw POST body (exact bytes the provider signed). */
  rawBody: string;
  query?: Record<string, string[]>;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  body: unknown;
  /**
   * Exact raw request body as received (byte-for-byte). Required for HMAC verification when the
   * provider signs the raw payload; `JSON.stringify(parsedBody)` is not equivalent.
   */
  rawBody?: string;
  query?: Record<string, string[]>;
}

/**
 * Relay service-instance binding for ingest (not sent by the provider).
 * Passed separately from {@link WebhookRequest} so plugins can verify and route using config,
 * without overloading the HTTP payload shape.
 */
export interface IngestInstanceConfig {
  /** Ingest URL segment / config key (`/ingest/:instanceId`). */
  instanceId: string;
  /** Registered plugin name for this instance. */
  serviceName: string;
  /** Base64-encoded webhook signing secret (e.g. HMAC verification). */
  signingSecret: string;
}

/** Return type of `parseWebhook` — normalized provider callback for the relay. */
export interface WebhookParseResult {
  /** Provider-assigned check / submission id (client `externalId`). */
  externalId?: string;
  status: CheckStatus;
  message?: string;
  result: Record<string, unknown> | null;
  /** Recovered from provider metadata round-trip (e.g. embedded JSON in `metadata.custom`). */
  clientId?: string;
  /** Recovered from provider metadata round-trip. */
  notifyUrl?: string;
}

/**
 * Context for optional {@link ServicePlugin.handleIngestWebhook}.
 * Each produced envelope is POSTed to the client `notify_url` as JSON.
 */
export interface IngestWebhookContext {
  request: WebhookRequest;
  /** Same instance binding passed to {@link ServicePlugin.verifyWebhook} / {@link ServicePlugin.parseWebhook}. */
  instance: IngestInstanceConfig;
  parsed: WebhookParseResult;
  credentials: Record<string, unknown>;
  occurredAtIso: string;
}

/**
 * One notify payload to forward after ingest. Runtime shape must match
 * `RelayNotifyEnvelope` from `@curvenote/check-relay-types`.
 */
export type IngestNotifyEnvelope = Record<string, unknown>;

// ── Configure context ──

/** Passed to `configure` so plugins can build public webhook URLs. */
export interface PluginConfigureContext {
  /**
   * Full base for ingest URLs, e.g.
   * `https://relay.example.com/api/v1/ingest` (no trailing slash).
   */
  ingestPublicBaseUrl: string;
  /** Signing secret from relay config (base64). */
  signingSecret: string;
  /** Service instance id (ingest URL segment and config key). */
  instanceId: string;
}

// ── Plugin interface ──

export interface ServicePlugin {
  name: string;
  manifest: ServiceManifest;

  /**
   * Authenticate the inbound webhook using **raw** body and headers only.
   * The relay calls this **before** `JSON.parse`; throw {@link WebhookSignatureInvalidError} when
   * verification fails (mapped to HTTP 401 on ingest).
   */
  verifyWebhook(request: WebhookVerifyRequest, instance: IngestInstanceConfig): Promise<void>;

  /**
   * Map verified JSON webhook payload to a normalized update (called only after {@link verifyWebhook}
   * succeeds and the relay has parsed the body).
   */
  parseWebhook(
    request: WebhookRequest,
    instance: IngestInstanceConfig,
  ): Promise<WebhookParseResult>;

  /**
   * Optional ingest orchestration after a successful `parseWebhook` (provider follow-up HTTP,
   * mapping to relay notify events). When omitted, the relay emits only the generic
   * `UPLOAD_*` envelopes from {@link WebhookParseResult.status}.
   */
  handleIngestWebhook?: (ctx: IngestWebhookContext) => Promise<readonly IngestNotifyEnvelope[]>;

  /**
   * Instance-level status / capabilities (no check id).
   * POST /api/v1/services/:serviceName/instances/:instanceId/status
   */
  getInstanceStatus(
    credentials: Record<string, unknown>,
    body: Record<string, unknown>,
  ): Promise<InstanceStatusResult>;

  configure(
    credentials: Record<string, unknown>,
    body: Record<string, unknown>,
    context?: PluginConfigureContext,
  ): Promise<PluginOperationResult>;

  getTerms(
    credentials: Record<string, unknown>,
    body: Record<string, unknown>,
  ): Promise<PluginOperationResult>;

  /**
   * Upload manuscript(s) and create a check at the provider.
   * On success, `result` should include **`externalId`** (provider id); the relay exposes it to the client.
   * {@link PluginUploadPayload} is built by the relay from the HTTP body.
   */
  upload(
    credentials: Record<string, unknown>,
    payload: PluginUploadPayload,
  ): Promise<PluginOperationResult>;

  /**
   * Check-scoped methods take **`externalId`** (same value as the URL segment and client `externalId`).
   */
  getCheckStatus(
    credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<PluginOperationResult | null>;

  getReportViewerUrl(
    credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<PluginOperationResult>;

  getCheckArtifacts(
    credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<PluginOperationResult>;

  startReportGeneration(
    credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<PluginOperationResult>;

  /**
   * Start or advance a named processing phase for a check (provider-specific).
   * The relay requires JSON body field **`phase`** (non-empty string); other fields are passed through in **`body`**.
   * POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/trigger-stage
   */
  triggerProcessingStage(
    credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<PluginOperationResult>;

  fetchReport(
    credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<PluginReportResult>;

  /** Optional: start similarity/PDF generation at the provider (see `POST …/report/pdf/start`). */
  startReportPdf?: (
    credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ) => Promise<PluginOperationResult>;
}

// ── Re-export manuscript file type (plugin methods often need it) ──
export type { SubmitManuscriptFile };
