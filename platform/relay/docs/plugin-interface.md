# Plugin interface reference

Reference for authors of **service plugins**: npm packages that implement `ServicePlugin` and are registered in the relay at deploy time.

**Canonical types** live in the workspace package **`@checks-relay/check-plugin-types`**:

| File                                                                                  | Contents                                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`packages/plugin-types/src/plugin.ts`](../../../packages/plugin-types/src/plugin.ts) | `ServicePlugin`, webhook types, manifests, operation results      |
| [`packages/plugin-types/src/relay.ts`](../../../packages/plugin-types/src/relay.ts)   | `PluginUploadPayload`, `SubmitManuscriptFile`, upload body shapes |

**Client-facing** HTTP and notify contracts are **`@checks-relay/check-relay-types`** — plugins do not define those; the relay maps plugin outcomes and webhooks into them. See [api-reference.md](api-reference.md) for REST and notify events.

---

## Overview

A plugin is a **single object** that implements **`ServicePlugin`**: a `manifest` for discovery, **`upload`** to send manuscript(s) to the provider, **`parseWebhook`** to verify and normalize inbound provider callbacks, and methods for status, reports, and terms.

The relay:

1. Resolves **service instance** config and builds **`credentials`** (see below) for each call.
2. Passes URL **`externalId`** to check-scoped plugin methods (same string as the client and relay use on the wire).
3. For ingest, calls **`parseWebhook`**, then may run service-specific logic before **`postNotify`** to the client’s `notifyUrl`.

Plugins may still think in provider terms (e.g. “submission” ids); expose them to the relay as **`externalId`** on check-scoped calls and **`WebhookParseResult`** so the contract matches the HTTP API.

---

## Registration

1. Implement `ServicePlugin` in `packages/service-plugin-<name>/src/index.ts`.
2. Import and register it in [`apps/relay/app/plugins/load-plugins.ts`](../app/plugins/load-plugins.ts).
3. Add `"@checks-relay/check-service-plugin-<name>": "*"` to **`apps/relay/package.json`**.

Examples: **`@checks-relay/check-service-plugin-echo`**

---

## Credentials

For every plugin method that accepts **`credentials: Record<string, unknown>`**, the relay passes **instance-scoped** fields from app-config (not the raw config row). That object includes:

| Key                  | Source          | Notes                             |
| -------------------- | --------------- | --------------------------------- |
| `apiKey`             | Instance secret | Provider API key                  |
| `apiUrl`             | Instance config | Provider base URL                 |
| `integrationName`    | Instance config | Sent to provider where applicable |
| `integrationVersion` | Instance config | Sent to provider where applicable |

Plugins should read only the keys they need and treat the object as opaque to the relay.

**`configure`** also receives **`PluginConfigureContext`** when the relay calls it:

| Field                 | Meaning                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `ingestPublicBaseUrl` | Base for webhook URLs, e.g. `https://relay.example.com/api/v1/ingest` (no trailing slash)      |
| `signingSecret`       | Webhook signing secret for this instance (e.g. base64 for HMAC verification in `parseWebhook`) |
| `instanceId`          | Config key for this service instance (ingest URL segment)                                      |

---

## `ServicePlugin`: relay route → method

Unless noted, authenticated relay routes are under **`/api/v1/services/:serviceName/instances/:instanceId/`**.

### Structural (not HTTP routes)

| Member     | Type              | Description                                                        |
| ---------- | ----------------- | ------------------------------------------------------------------ |
| `name`     | `string`          | Must match **`manifest.name`** and the URL segment `:serviceName`. |
| `manifest` | `ServiceManifest` | Discovery: title, description, version, logo, metadata.            |

### Discovery (no instance in path)

| Relay HTTP route                                             | Plugin method                             |
| ------------------------------------------------------------ | ----------------------------------------- |
| `GET /api/v1/services` / `GET /api/v1/services/:serviceName` | _(no call — relay reads `manifest` only)_ |

### Instance setup

| Relay HTTP route                                                     | Plugin method       |
| -------------------------------------------------------------------- | ------------------- |
| `POST /api/v1/services/:serviceName/instances/:instanceId/status`    | `getInstanceStatus` |
| `POST /api/v1/services/:serviceName/instances/:instanceId/configure` | `configure`         |
| `POST /api/v1/services/:serviceName/instances/:instanceId/terms`     | `getTerms`          |

### Upload (manuscript)

| Relay HTTP route                                                  | Plugin method |
| ----------------------------------------------------------------- | ------------- |
| `POST /api/v1/services/:serviceName/instances/:instanceId/upload` | `upload`      |

### Check-scoped (`:externalId` in URL → plugin `externalId` argument)

| Relay HTTP route                                                                                     | Plugin method                 |
| ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| `POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/status`                  | `getCheckStatus`              |
| `POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/artifacts`               | `getCheckArtifacts`           |
| `POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/trigger-stage`           | `triggerProcessingStage`      |
| `POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/start-generation` | `startReportGeneration`       |
| `POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/fetch`            | `fetchReport`                 |
| `POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/viewer-url`       | `getReportViewerUrl`          |
| `POST /api/v1/services/:serviceName/instances/:instanceId/check/:externalId/report/pdf/start`        | `startReportPdf` _(optional)_ |

### Provider → relay (ingest)

| Relay HTTP route                                            | Plugin method  |
| ----------------------------------------------------------- | -------------- |
| `POST /api/v1/ingest/:instanceId` (+ optional `/:uniqueId`) | `parseWebhook` |

---

## Method reference (by group)

### Discovery and instance setup

#### `getInstanceStatus(credentials, body)`

Instance-wide capabilities or health (no check id). Returns **`InstanceStatusResult`** (a JSON object). The relay wraps this with manifest detail for the `POST /api/v1/services/:serviceName/instances/:instanceId/status` response.

#### `configure(credentials, body, context?)`

Webhook registration or provider setup for this instance. Returns **`PluginOperationResult`**. Receives **`PluginConfigureContext`** as third argument when invoked from the relay.

#### `getTerms(credentials, body)`

Legal / EULA flow. Returns **`PluginOperationResult`**.

### Upload

#### `upload(credentials, payload)`

Upload manuscript(s) and create a submission at the provider. **`payload`** is **`PluginUploadPayload`**:

| Field        | Type                      | Description                                                      |
| ------------ | ------------------------- | ---------------------------------------------------------------- |
| `clientId`   | `string`                  | Client idempotency key; echoed in notify metadata                |
| `notifyUrl`  | `string`                  | Where the relay POSTs notify envelopes                           |
| `instanceId` | `string`                  | Service instance id (URL path; config key)                       |
| `files`      | `SubmitManuscriptFile[]`  | `{ url, filename }` — relay supplies presigned or fetchable URLs |
| `metadata`   | `Record<string, unknown>` | Plugin-specific; relay normalizes missing to `{}`                |

Returns **`PluginOperationResult`**. On success, **`result`** should include **`externalId`** (provider-side check / submission id); the relay passes the same value to the client as **`externalId`**.

### Check-scoped methods

All take **`externalId: string`** (same value as the URL segment **`externalId`**).

| Method                   | Returns                         | Notes                                                                                             |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `getCheckStatus`         | `PluginOperationResult \| null` | Relay JSON-defaults if `null`.                                                                    |
| `getReportViewerUrl`     | `PluginOperationResult`         |                                                                                                   |
| `getCheckArtifacts`      | `PluginOperationResult`         |                                                                                                   |
| `triggerProcessingStage` | `PluginOperationResult`         | Relay requires **`phase`** (non-empty string). Use for stages not driven only by ingest webhooks. |
| `startReportGeneration`  | `PluginOperationResult`         |                                                                                                   |
| `fetchReport`            | **`PluginReportResult`**        | `kind: "json"` → JSON body; `kind: "binary"` → PDF bytes + `contentType`.                         |
| `startReportPdf`         | `PluginOperationResult`         | **Optional.** If omitted, relay returns an error for that route.                                  |

**`body`** on these routes is the JSON body from the client minus top-level `credentials`. The instance is not repeated in the body. Plugins read service-specific fields (e.g. `pdf_id`) from **`body`**.

### Ingest

Ingest runs in order: **`verifyWebhook`** (raw body only, no `JSON.parse` yet) → relay parses JSON → **`parseWebhook`** (parsed body + headers).

#### `verifyWebhook(request, instance): Promise<void>`

| `WebhookVerifyRequest` field | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `headers`                    | Normalized to lowercase keys by the relay ingest route |
| `rawBody`                    | Exact raw POST body string (what the provider signed)  |
| `query`                      | Optional query multi-map                               |

Throw **`WebhookSignatureInvalidError`** when authentication fails (relay returns **401**). Use **`IngestInstanceConfig.signingSecret`** (and headers) only — do not parse JSON here.

#### `parseWebhook(request, instance): Promise<WebhookParseResult>`

| `WebhookRequest` field | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `headers`              | Same as verify step                                     |
| `body`                 | Parsed JSON (or `null` for empty body)                  |
| `rawBody`              | Same raw string as in verify (convenience for handlers) |
| `query`                | Optional query multi-map                                |

| `IngestInstanceConfig` field | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `instanceId`                 | Ingest URL segment / relay config key                                |
| `serviceName`                | Registered plugin name for this instance                             |
| `signingSecret`              | Base64 webhook signing secret from relay instance config (e.g. HMAC) |

Map the **verified** JSON payload to **`WebhookParseResult`**:

| Field        | Type                              | Description                                                            |
| ------------ | --------------------------------- | ---------------------------------------------------------------------- |
| `status`     | `CheckStatus`                     | Same string union as **`PluginStatus`**                                |
| `externalId` | `string?`                         | Provider check / submission id — required for relay routing when known |
| `message`    | `string?`                         | Human-readable detail                                                  |
| `result`     | `Record<string, unknown> \| null` | Extra structured data                                                  |
| `clientId`   | `string?`                         | From provider metadata round-trip                                      |
| `notifyUrl`  | `string?`                         | From provider metadata round-trip                                      |

The relay uses **`clientId`** and **`notifyUrl`** from this update (or from parsed metadata) to forward notifies. If **`notifyUrl`** is missing, the relay logs and does not POST.

---

## Core types

### `PluginStatus`

`"submitted" | "processing" | "completed" | "failed" | "error"`

Used as **`PluginOperationResult.status`** and anywhere a plugin returns a standard outcome (upload, configure, terms, check-scoped routes, etc.).

### `CheckStatus`

Type alias of **`PluginStatus`** — same values, for **`WebhookParseResult.status`** and other check / ingest-oriented documentation.

### `WebhookParseResult`

Return type of **`parseWebhook`** (ingest). Includes optional **`externalId`**, **`status`**, **`result`**, and metadata round-trip fields **`clientId`** / **`notifyUrl`**.

### `PluginOperationResult<T>`

| Field     | Type           |
| --------- | -------------- |
| `status`  | `PluginStatus` |
| `message` | `string?`      |
| `result`  | `T \| null`    |

### `PluginReportResult`

- `{ kind: "json"; response: PluginOperationResult }`
- `{ kind: "binary"; body: Uint8Array; contentType: string }`

### `ServiceManifest`

| Field                             | Description                                           |
| --------------------------------- | ----------------------------------------------------- |
| `name`                            | Service id (matches plugin `name`)                    |
| `title`, `description`, `version` | Discovery copy                                        |
| `logo`                            | Absolute URL or path starting with `/`                |
| `metadata`                        | `Record<string, unknown>` for capabilities / UI hints |

---

## Optional methods

Only **`startReportPdf`** is optional on **`ServicePlugin`**. If your provider has no similarity-PDF API, omit it; **`POST …/check/:externalId/report/pdf/start`** will return an error when called.

---

## Related documentation

- [api-reference.md](api-reference.md) — SCMS REST API and notify envelope reference
- [config.md](config.md) — Relay and service instance configuration
