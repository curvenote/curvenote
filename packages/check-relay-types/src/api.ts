/**
 * Client-facing relay API contract types (HTTP request/response shapes).
 *
 * These are standard across plugins; plugin-specific options belong under `metadata`.
 */

import type { PluginStatus } from "@checks-relay/check-plugin-types";

/**
 * Standard upload request body sent by clients to checks-relay (wire shape).
 * Service instance is selected by the URL path, not the body.
 */
export interface RelayUploadRequestBodyWire {
  client_id: string;
  files: Array<{ url: string; filename: string }>;
  notify_url: string;
  /** Plugin-specific options; validated/interpreted by the plugin. */
  metadata?: Record<string, unknown>;
}

/** List item (GET /api/v1/services). */
export interface ServiceListItem {
  name: string;
  title: string;
  description: string;
  version: string;
  logo: string;
  metadata: Record<string, unknown>;
}

/** Service detail (GET /api/v1/services/:name). */
export interface ServiceDetailResponse {
  name: string;
  title: string;
  description: string;
  version: string;
  logo: string;
  metadata: Record<string, unknown>;
}

/** Response after a successful upload (`POST …/upload`). */
export interface CheckResponse {
  externalId: string;
  clientId: string;
  serviceName: string;
  status: PluginStatus;
}

export interface CheckStatusResponse {
  externalId: string;
  clientId: string;
  serviceName: string;
  status: PluginStatus;
  result: Record<string, unknown> | null;
}
