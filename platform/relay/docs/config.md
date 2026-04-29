# Checks Relay Configuration

The relay uses [`@app-config`](https://app-config.dev/) to load and validate YAML configuration. Config files live in `apps/relay/`.

## File Layout

| File                                  | Purpose                            | Committed?          |
| ------------------------------------- | ---------------------------------- | ------------------- |
| `.app-config.schema.yml`              | JSON Schema (validation)           | yes                 |
| `.app-config.development.yml`         | Dev environment non-secrets        | yes                 |
| `.app-config.secrets.development.yml` | Dev environment secrets            | **no** (gitignored) |
| `.app-config.secrets.sample.yml`      | Template for secrets file          | yes                 |
| `.app-config.test.yml`                | Test environment non-secrets       | yes                 |
| `.app-config.secrets.test.yml`        | Test environment secrets (fixture) | yes                 |

To set up local dev secrets:

```bash
cp .app-config.secrets.sample.yml .app-config.secrets.development.yml
# then edit with your actual keys
```

The environment is selected via `APP_CONFIG_ENV`, `NODE_ENV`, or `ENV`. The `npm run dev` script sets `NODE_ENV=development`.

## Configuration Reference

### Top-level

| Field            | Type    | Required | Secret? | Description                                                                                                                                                                                            |
| ---------------- | ------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `port`           | integer | yes      | no      | HTTP listen port (1–65535)                                                                                                                                                                             |
| `apiKey`         | string  | yes      | **yes** | Relay API key. Clients send this as `Authorization: Bearer <apiKey>` to authenticate against the relay. This is **not** a provider key.                                                                |
| `publicBaseUrl`  | string  | no       | no      | Public origin of this relay (e.g. `https://relay.example.com`). Used to resolve root-relative plugin logos into absolute URLs in service list responses.                                               |
| `webhookBaseUrl` | string  | no       | no      | Origin that external providers should call for webhooks (e.g. a tunnel URL). When set, `/configure` uses this instead of `publicBaseUrl` to build the ingest webhook URL registered with the provider. |
| `instances`      | object  | yes      | mixed   | Map of **service instances** (at least one required). Keys are **instance ids** used in URLs.                                                                                                          |

### Service instance (`instances.<instanceId>`)

Each entry configures credentials and routing for one linked provider account (one row per integration you want to call).

| Field                | Type   | Required | Secret? | Description                                                        |
| -------------------- | ------ | -------- | ------- | ------------------------------------------------------------------ |
| `serviceName`        | string | yes      | no      | Plugin name this instance routes to                                |
| `apiKey`             | string | yes      | **yes** | Provider API key                                                   |
| `apiUrl`             | string | yes      | no      | Provider API base URL                                              |
| `signingSecret`      | string | yes      | **yes** | Base64-encoded webhook signing secret for HMAC-SHA256 verification |
| `integrationName`    | string | yes      | no      | Integration name sent to the provider (e.g. `checks-relay`)        |
| `integrationVersion` | string | yes      | no      | Integration version sent to the provider (e.g. `1.0.0`)            |

### Secret vs Non-Secret Split

Non-secret fields go in the environment config file (e.g. `.app-config.development.yml`):

```yaml
port: 4041
publicBaseUrl: http://localhost:4041
webhookBaseUrl: https://relay-dev.example.com

instances:
  default:
    serviceName: external-service
    apiUrl: 'https://app.external-service.com'
    integrationName: 'checks-relay'
    integrationVersion: '1.0.0'
```

Secrets go in the secrets file (e.g. `.app-config.secrets.development.yml`):

```yaml
apiKey: your-relay-api-key

instances:
  default:
    apiKey: 'your-extrnal-api-key'
    signingSecret: 'base64-encoded-signing-secret'
```

The two files are deep-merged at load time. The schema validates the merged result.

## Multiple provider accounts

Add additional entries under `instances` when one SCMS uses several provider credential sets (e.g. two Turnitin accounts):

```yaml
instances:
  org-alpha:
    serviceName: image-checks
    apiUrl: 'https://app.image-checks'
    integrationName: 'checks-relay'
    integrationVersion: '1.0.0'
  org-beta:
    serviceName: external-service
    apiUrl: 'https://app.external-service.com'
    integrationName: 'checks-relay'
    integrationVersion: '1.0.0'
```

The **instance id** appears in client API paths: `/api/v1/services/:serviceName/instances/:instanceId/...`. Ingest webhooks use the same id: `/api/v1/ingest/:instanceId`.

---

See also [api-reference.md](api-reference.md) (REST and notifies) and [plugin-interface.md](plugin-interface.md) (implementing providers).
