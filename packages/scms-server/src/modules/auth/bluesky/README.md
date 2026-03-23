# Bluesky OAuth auth provider

This module adds [Bluesky](https://bsky.app) as an OAuth 2 auth provider using the [Atproto OAuth client](https://docs.bsky.app/docs/advanced-guides/oauth-client). It uses a **confidential client** with `private_key_jwt` and JWKS.

## Configuration

### App config (`.app-config.schema.yml`)

- **`auth.bluesky.clientId`** (required): Full URL where the app serves OAuth client metadata (e.g. `https://your-app.com/auth/bluesky` or `https://your-app.com/auth/bluesky/client-metadata`). The Bluesky OAuth server will fetch client metadata from this URL.
- **`auth.bluesky.redirectUrl`** (required): Callback URL registered with the OAuth flow (e.g. `https://your-app.com/auth/bluesky/callback`).
- **`auth.bluesky.displayName`** (optional): Display name for the provider in the UI.
- **`auth.bluesky.jwksUri`** (optional): URL where the app serves its JWKS (e.g. `https://your-app.com/auth/bluesky/jwks`). If omitted and `privateKeyPem` is set, the module can derive a default from `clientId` (e.g. `clientId` + `/jwks`).
- **OAuth `scope`**: Client metadata requests `atproto transition:generic` so the access token can call the Bluesky AppView (e.g. `app.bsky.actor.getProfile` after login). If you change scopes, users must complete the OAuth flow again to grant the new scopes.
- **`auth.bluesky.allowLogin`** (optional, default `true`): Allow sign-in with Bluesky.
- **`auth.bluesky.provisionNewUser`** (optional, default `false`): Create a new user when someone signs in with Bluesky and no linked account exists.
- **`auth.bluesky.allowLinking`** (optional, default `false`): Allow linking a Bluesky account to an existing user.
- **`auth.bluesky.adminLogin`** (optional, default `false`): Allow Bluesky sign-in on the admin login page.
- **`auth.bluesky.pdsHostname`** (optional, default `https://bsky.social`): Passed to Atproto OAuth `authorize()` as the account/service to use. Must be a **handle** (e.g. `alice.bsky.social`), **DID**, or **`https://` PDS URL** — not a bare hostname. The value `bsky.social` alone is not a valid handle; use `https://bsky.social` for the Bluesky service (bare `bsky.social` in config is normalized to that).

### Secrets

- **`auth.bluesky.privateKeyPem`**: PEM-encoded private key used for `private_key_jwt` client authentication. Required for the confidential client. The corresponding public key is exposed in the JWKS at `jwks_uri`.

## Key generation

Generate an ES256 (P-256) private key as **PKCS#8** PEM (`BEGIN PRIVATE KEY`). The Atproto stack expects PKCS#8; SEC1 (`BEGIN EC PRIVATE KEY`) is normalized at runtime.

```bash
# Private key (PEM) — store in secrets as auth.bluesky.privateKeyPem
openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -outform PEM
```

The app uses `@atproto/jwk-jose` to load the PEM and publish the public key in the JWKS.

## Routes

The platform must expose:

1. **POST `/auth/bluesky`** – Start OAuth (form post from login / link-account UI).
2. **GET `/auth/bluesky/callback`** – OAuth callback (code + state).
3. **GET `/auth/bluesky/client-metadata`** – Serves OAuth client metadata JSON (used when `clientId` points here or when the issuer fetches metadata).
4. **GET `/auth/bluesky/jwks`** – Serves JWKS JSON for `jwks_uri`.

If `clientId` is the base URL (e.g. `https://your-app.com/auth/bluesky`), the Bluesky OAuth server may request `GET {clientId}` or `GET {clientId}/.well-known/oauth-client-configuration`. Configure your app so that the URL that the issuer uses for client metadata is the same as `clientId` and returns the same JSON as `/auth/bluesky/client-metadata`.

## Callback URL

Register the exact callback URL (e.g. `https://your-app.com/auth/bluesky/callback`) with the Bluesky OAuth application. Redirect URI must match exactly.

## Example YAML

**App config** (non-secret):

```yaml
auth:
  bluesky:
    clientId: "https://your-app.com/auth/bluesky/client-metadata"
    redirectUrl: "https://your-app.com/auth/bluesky/callback"
    jwksUri: "https://your-app.com/auth/bluesky/jwks"
    displayName: "Bluesky"
    allowLogin: true
    provisionNewUser: false
    allowLinking: true
    adminLogin: false
    pdsHostname: "https://bsky.social"
```

**Secrets** (e.g. in a secrets store or env):

```yaml
auth:
  bluesky:
    privateKeyPem: |
      -----BEGIN PRIVATE KEY-----
      ...
      -----END PRIVATE KEY-----
```

## Local development (HTTPS tunnel)

For a working OAuth flow against `bsky.social`, your **client metadata** and **JWKS** must be reachable at **`https://` URLs**. See **[LOCAL_DEV.md](./LOCAL_DEV.md)** for **Cloudflare Tunnel** (`cloudflared`) setup, app config examples, and why **Cloudflare Access** should not sit in front of the app while testing Bluesky OAuth.

## Sessions: app cookie vs Atproto OAuth

These are **separate**:

| Mechanism | What it is | Where it lives |
|-----------|------------|----------------|
| **Curvenote session** | “Logged into SCMS” (`userId`, provider flags, etc.) | Encrypted cookie (`__session`), see `session.server.ts` |
| **Atproto OAuth session** | Access/refresh tokens + DPoP material for Bluesky / PDS APIs | Managed by `@atproto/oauth-client` keyed by user **DID** (`sub`) |

Logging in with Bluesky establishes **both**. The cookie does **not** contain Bluesky tokens.

## Where OAuth state and tokens live

1. **`stores.server.ts`**
   - **`blueskyStateStore`**: short-lived OAuth **state** (PKCE/state parameters) during the redirect dance; TTL ~1 hour.
   - **`blueskySessionStore`**: in-memory `Map` used by **`NodeOAuthClient`** as the **authoritative** store for Atproto sessions **after** the callback (token set + DPoP key per `sub`).

2. **Database — `UserLinkedAccountSession`** (`session-db.server.ts`, Prisma model in `user.prisma`)
   - Apply the repo migration that creates this table (see `prisma/schema/migrations/`).
   - After a successful login/link, the strategy copies the in-memory session into Postgres via **`persistBlueskySessionForLinkedAccount`** (deactivates prior rows for that linked account, inserts the new active session).
   - Intended for **long-lived** use (e.g. future PDS publish flows loading tokens by linked account id). **Today**, the OAuth client does not automatically **reload** from this table on server boot — see *Limitations* below.

## Token refresh (access token staleness)

Refresh is handled **inside `@atproto/oauth-client`**, not by custom SCMS code:

- The client wraps your `sessionStore` with a **`SessionGetter`** that tracks token expiry (`expires_at`).
- When a token is **stale** (near expiry, with jitter), the client uses the **refresh token** to obtain a new access token (and usually a rotated refresh token) and **writes the updated session back** to `blueskySessionStore` via `setStored`.
- API calls through **`OAuthSession`** (e.g. `fetchHandler`) retry on invalid token by forcing a refresh when possible.

So **while the process is running** and the in-memory store still holds a session with a valid **refresh token**, access tokens are refreshed transparently.

If refresh fails (revoked refresh token, `invalid_grant`, user revoked app access, etc.), the library may **delete** the session from the store. The user may still have a valid **Curvenote cookie** but Bluesky API calls will fail until they **complete Bluesky OAuth again** (link / sign-in).

## Limitations and operations notes

- **Process restart**: `blueskySessionStore` is **in-memory only** — it is **empty** after deploy/restart. Rows in **`UserLinkedAccountSession`** are **not** currently re-applied into `NodeOAuthClient` on startup. Until a “restore from DB into the client” path exists, a new OAuth round-trip may be needed for code paths that rely on `NodeOAuthClient.restore(sub)` without a prior callback in that process.
- **Single instance**: In-memory stores are appropriate for one Node process. **Horizontal scale** or multiple workers requires a **shared** implementation of the same store interface (e.g. Redis) for **both** `stateStore` and `sessionStore`, plus coordination on refresh (the upstream client documents refresh-token concurrency).
- **Strategy registration**: If `clientId` / `redirectUrl` are set but **`privateKeyPem`** is missing, registration **throws** (fail fast). If Bluesky is omitted from config entirely, the strategy is simply not registered.

## Related files

| File | Role |
|------|------|
| `register.server.ts` | Strategy, OAuth client creation, post-callback persist to DB |
| `metadata.server.ts` | Client metadata JSON (`scope`, `redirect_uris`, JWKS ref) |
| `session-db.server.ts` | Prisma read/write for `UserLinkedAccountSession` |
| `stores.server.ts` | In-memory OAuth state + session stores for `@atproto/oauth-client-node` |
| **[LOCAL_DEV.md](./LOCAL_DEV.md)** | HTTPS tunnel, localhost constraints, troubleshooting |
