# Bluesky OAuth auth provider

This module adds [Bluesky](https://bsky.app) as an OAuth 2 auth provider using the [Atproto OAuth client](https://docs.bsky.app/docs/advanced-guides/oauth-client). It uses a **confidential client** with `private_key_jwt` and JWKS.

## Configuration

### App config (`.app-config.schema.yml`)

- **`auth.bluesky.clientId`** (required): Full URL where the app serves OAuth client metadata (e.g. `https://your-app.com/auth/bluesky` or `https://your-app.com/auth/bluesky/client-metadata`). The Bluesky OAuth server will fetch client metadata from this URL.
- **`auth.bluesky.redirectUrl`** (required): Callback URL registered with the OAuth flow (e.g. `https://your-app.com/auth/bluesky/callback`).
- **`auth.bluesky.displayName`** (optional): Display name for the provider in the UI.
- **`auth.bluesky.jwksUri`** (optional): URL where the app serves its JWKS (e.g. `https://your-app.com/auth/bluesky/jwks`). If omitted and `privateKeyPem` is set, the module can derive a default from `clientId` (e.g. `clientId` + `/jwks`).
- **`auth.bluesky.allowLogin`** (optional, default `true`): Allow sign-in with Bluesky.
- **`auth.bluesky.provisionNewUser`** (optional, default `false`): Create a new user when someone signs in with Bluesky and no linked account exists.
- **`auth.bluesky.allowLinking`** (optional, default `false`): Allow linking a Bluesky account to an existing user.
- **`auth.bluesky.adminLogin`** (optional, default `false`): Allow Bluesky sign-in on the admin login page.
- **`auth.bluesky.pdsHostname`** (optional, default `bsky.social`): PDS hostname used as the login hint for the OAuth authorization URL.

### Secrets

- **`auth.bluesky.privateKeyPem`**: PEM-encoded private key used for `private_key_jwt` client authentication. Required for the confidential client. The corresponding public key is exposed in the JWKS at `jwks_uri`.

## Key generation

Generate an ES256 key pair for the client:

```bash
# Private key (PEM) - store in secrets as auth.bluesky.privateKeyPem
openssl ecparam -name prime256v1 -genkey -noout -out private.pem

# Public key / JWK can be derived by the app for JWKS
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
    pdsHostname: "bsky.social"
```

**Secrets** (e.g. in a secrets store or env):

```yaml
auth:
  bluesky:
    privateKeyPem: |
      -----BEGIN EC PRIVATE KEY-----
      ...
      -----END EC PRIVATE KEY-----
```

## Local development (HTTPS tunnel)

For a working OAuth flow against `bsky.social`, your **client metadata** and **JWKS** must be reachable at **`https://` URLs**. See **[LOCAL_DEV.md](./LOCAL_DEV.md)** for **Cloudflare Tunnel** (`cloudflared`) setup, app config examples, and why **Cloudflare Access** should not sit in front of the app while testing Bluesky OAuth.

## In-memory state and session

OAuth state and atproto session are stored in memory (no DB). Suitable for a single-instance server. For multiple instances, you would need a shared state/session store (e.g. Redis) and adapt the stores in `stores.server.ts`.
