# Relay (`platform/relay`)

Middleware API relay between an SCMS and external check services. It exposes a consistent REST API for the SCMS and a plugin architecture for integrating third-party providers.

Package name: **`@curvenote/check-relay`**.

## Architecture

```
SCMS  ──REST──▶  relay  ──plugins──▶  external check services
                  │    ▲
                  │    webhooks (ingest)
                  └──▶ notifyUrl callbacks
```

- **Client API** — SCMS discovers services, starts checks, polls status, fetches reports.
- **Plugin system** — each external integration is an npm package implementing `ServicePlugin`.
- **Webhook ingestion** — providers call `POST /api/v1/ingest/:instanceId`; plugins verify and parse payloads.
- **Notify forwarding** — updates are forwarded to the client’s `notifyUrl`.

## Prerequisites

- **Node.js** ≥ 20
- Dependencies are linked from the **Curvenote monorepo root** (`npm install` at the repo root so `platform/relay` and `packages/*` workspaces resolve).

## Setup

### Install

From the monorepo root:

```sh
cd /path/to/curvenote
npm install
```

### App config (development)

Configuration files live in **`platform/relay/`** and use [app-config](https://app-config.dev).

- **`npm run dev`** (from `platform/relay`) sets `NODE_ENV=development`, which loads `.app-config.development.yml` and merges `.app-config.secrets.development.yml` (`apiKey`, per-instance secrets). If you do not have a secrets file yet:

  ```sh
  cd platform/relay
  cp .app-config.secrets.sample.yml .app-config.secrets.development.yml
  ```

  Edit values to match your environment. Non-secret shape is illustrated in `.app-config.sample.yml`.

- **Vitest** sets `APP_CONFIG_ENV=test` and uses committed `.app-config.test.yml` / `.app-config.secrets.test.yml` (no local copy required).

See **[docs/config.md](docs/config.md)** for configuration fields (`apiKey`, `instances`, `publicBaseUrl`, `webhookBaseUrl`, etc.).

## Running

### Dev server (hot reload)

```sh
cd platform/relay
npm run dev
```

Default dev port is **4041** (see `.app-config.development.yml`); open `http://localhost:4041`.

`npm run dev` sets `NODE_OPTIONS='--conditions=development'` so workspace packages resolve to **TypeScript source** where `package.json` `exports.development` is defined—you typically do not need to build those packages first for local dev.

### Build and run (local, production-like)

Production output is **`dist/server.js`**: esbuild bundles application code; `npm run build` runs `clean`, `copy-plugin-assets`, typecheck, then the bundle. Dependencies remain in `node_modules` (external in the bundle) so packages such as `@app-config/*` work at runtime.

```sh
cd platform/relay
npm run build
NODE_ENV=production npm start
```

`npm run build` runs **`npm run typecheck`** (`tsc --noEmit`) before bundling. The process listens on `port` from app-config. `dist/server.js` loads `dotenv/config` before config, so a local `.env` can supply variables referenced by app-config.

## API reference

- **HTTP (SCMS-facing):** [docs/api-reference.md](docs/api-reference.md)
- **Plugins:** [docs/plugin-interface.md](docs/plugin-interface.md)

Summary:

- **Discovery:** `GET /api/v1`, `GET /api/v1/services`, `GET /api/v1/services/:serviceName`
- **Setup:** `POST …/instances/:instanceId/configure`, `…/terms`, `…/status`
- **Checks:** `POST …/upload`, plus check-scoped routes under `…/check/:externalId/` (`status`, `artifacts`, `trigger-stage`, report routes, etc.)
- **Ingest:** `POST /api/v1/ingest/:instanceId` (plugin-verified; no relay Bearer auth)

## Testing

```sh
cd platform/relay
npm test
```

Vitest uses `APP_CONFIG_ENV=test`. `app/test-setup.ts` loads config before tests run.

## Monorepo layout (this area)

```
curvenote/
├── platform/relay/              # this app (Hono, routes, plugins registry)
│   ├── app/
│   │   ├── routes/v1/
│   │   ├── plugins/
│   │   └── middleware/
│   ├── api/                     # optional Vercel-style entry
│   ├── docs/
│   └── .app-config.*.yml
└── packages/
    ├── check-plugin-types/      # @curvenote/check-plugin-types
    ├── check-relay-types/       # @curvenote/check-relay-types
    └── check-service-plugin-echo/   # example plugin
```

## Adding a plugin

Plugins are **workspace packages** that default-export a **`ServicePlugin`** from `@curvenote/check-plugin-types`. The relay discovers them only after you register them in code and wire app-config instances to the plugin’s **`manifest.name`** (the `:serviceName` URL segment).

### 1. Create a package

Add a new workspace package under the monorepo, e.g. **`packages/check-service-plugin-<name>/`**, following the layout of **`packages/check-service-plugin-echo/`**:

- **`package.json`** — name **`@curvenote/check-relay-plugin-<name>`**, `type: "module"`, dependency on **`@curvenote/check-plugin-types`**, and **`exports`** that expose `./src/index.ts` under the `development` condition (and built `dist/` for production if you emit one).
- **`src/index.ts`** — implement **`ServicePlugin`**: `manifest` (name, title, description, version, optional logo path / metadata), `configure`, `getTerms`, `getInstanceStatus`, `upload`, check-scoped methods (`getCheckStatus`, `getCheckArtifacts`, report helpers, optional PDF/report hooks), and **`parseWebhook`** for ingest. The manifest **`name`** must match the **`serviceName`** you use in app-config and in URLs.

Use **`@curvenote/check-relay-plugin-echo`** as the minimal reference implementation.

### 2. Register the plugin in the relay

**Plugins under `extensions/plugins/`** with a package name matching **`@scope/check-relay-plugin-*`** (or unscoped `check-relay-plugin-*`) are picked up automatically: root **`postinstall`** runs **`generate:relay-plugins`**, which merges them into **`platform/relay/package.json`** (from **`package.template.json`**) and regenerates **`app/plugins/load-plugins.ts`** from **`app/plugins/load-plugins.tpl.ts`**.

For plugins that live **outside** `extensions/plugins/` (e.g. **`packages/check-relay-plugin-*`**):

1. Add a **workspace dependency** in **`platform/relay/package.template.json`**:

   ```json
   "@curvenote/check-relay-plugin-<name>": "*"
   ```

2. Import it and pass it to **`loadPlugins`** in **`app/plugins/load-plugins.tpl.ts`** (template for the generated **`load-plugins.ts`**).

3. Run **`npm install`** from the **monorepo root** so **`preinstall`** clears generated files and **`postinstall`** regenerates **`platform/relay/package.json`** and the loader.

### 3. Configure instances

For each deployment environment, add an entry under **`instances:`** in the non-secret app-config (and matching keys under **`instances:`** in the secrets file). Set **`serviceName`** to the plugin’s manifest name. See **[docs/config.md](docs/config.md)** and **[docs/plugin-interface.md](docs/plugin-interface.md)** for credential fields passed into plugin methods.

### 4. Optional assets

If the manifest references a logo path, use a root-relative URL under **`/api/assets/<serviceName>/…`** (for example **`/api/assets/echo/logo.svg`**). On disk, `copy-plugin-assets` still mirrors plugin packages into **`platform/relay/public/assets/<serviceName>/`** (see **`scripts/copy-plugin-assets.mjs`**); the relay serves that tree at **`GET /api/assets/<serviceName>/…`** so the same paths work behind Vercel’s **`api/[[...route]].ts`** entry without extra rewrites. The echo plugin is a concrete example.

### 5. Types and contracts

- **Plugin implementation types:** `@curvenote/check-plugin-types`
- **Wire formats / notify payloads (implemented by the relay, not plugins):** `@curvenote/check-relay-types`

## Environment variables

At runtime the relay reads configuration from app-config (merged YAML + secrets). `dotenv` may load a local `.env` for development. See **[docs/config.md](docs/config.md)** for the authoritative list of config keys.
