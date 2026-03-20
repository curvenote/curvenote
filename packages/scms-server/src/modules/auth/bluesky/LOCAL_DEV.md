# Local development: HTTPS and public URLs (e.g. Cloudflare Tunnel)

The [AT Protocol OAuth profile](https://docs.bsky.app/docs/advanced-guides/oauth-client) expects your **client metadata** to be fetched from a **`https://` URL** on the public internet. Plain `http://localhost` is usually not enough for a full end-to-end test against `bsky.social`, because the authorization server must be able to **retrieve** your `client_id` (metadata URL) and validate your **JWKS** and **redirect URI**.

A common approach is to run the SCMS app locally and expose it with **HTTPS** via **Cloudflare Tunnel** (`cloudflared`) on a hostname you control (e.g. `dev.scms.example.com`).

## Do not put Cloudflare Access in front of this app (for Bluesky OAuth testing)

**Cloudflare Access** adds its own login in front of your origin. That is separate from Bluesky OAuth and will interfere with or block the normal redirect flow to `bsky.social` and back to `/auth/bluesky/callback`.

For Bluesky OAuth development, use **only** the tunnel (HTTPS + DNS to localhost). Skip Access / Zero Trust application policies on this hostname unless you have an unusual setup and know how to exempt OAuth paths.

## Prerequisites

- A domain on **Cloudflare** (DNS hosted there) for `cloudflared tunnel route dns`.
- **SCMS** running locally on the port you will forward (default dev: **3031** — see `platform/scms` / `.app-config.development.yml`).

## 1. Install `cloudflared`

**macOS (Homebrew):**

```bash
brew install cloudflared
```

**Linux:**

```bash
wget "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -O cloudflared
sudo mv cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

**Windows:** install from [Cloudflare cloudflared releases](https://github.com/cloudflare/cloudflared/releases/latest).

## 2. Authenticate and create a tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create scms-local-dev
cloudflared tunnel list
```

Note the **tunnel ID** and the **credentials file path** printed after `tunnel create` (a JSON file under `~/.cloudflared/`).

## 3. Configure ingress to your local SCMS

Create a config file, e.g. `~/.cloudflared/scms-local-dev.yml`:

```yaml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /path/to/<tunnel-id>.json

ingress:
  - hostname: dev.scms.example.com
    service: http://localhost:3031
  - service: http_status:404
```

Replace:

- `dev.scms.example.com` with your real dev hostname.
- `http://localhost:3031` with your local SCMS URL if different.

## 4. Route DNS to the tunnel

```bash
cloudflared tunnel route dns scms-local-dev dev.scms.example.com
```

(Use your tunnel **name** and hostname.)

## 5. Run the tunnel

```bash
cloudflared tunnel --config ~/.cloudflared/scms-local-dev.yml run scms-local-dev
```

Leave this running while you develop. Visit `https://dev.scms.example.com` — you should hit your local app with valid HTTPS.

## 6. Point SCMS Bluesky config at the tunnel URL

In `.app-config.development.yml` (and matching secrets), set all three to the **same origin** you use in the browser:

```yaml
auth:
  bluesky:
    clientId: https://dev.scms.example.com/auth/bluesky/client-metadata
    redirectUrl: https://dev.scms.example.com/auth/bluesky/callback
    jwksUri: https://dev.scms.example.com/auth/bluesky/jwks
    pdsHostname: bsky.social
```

Keep **`auth.bluesky.privateKeyPem`** in your secrets file (ES256 PEM). Regenerate with:

```bash
openssl ecparam -name prime256v1 -genkey -noout | openssl ec -outform PEM
```

Ensure **`api.url`**, **`app.adminUrl`**, and any base URL your app uses for links match how you open the app (**`https://dev.scms.example.com`**, not `http://localhost:3031`).

## 7. Verify metadata and JWKS

From any machine:

```bash
curl -sS "https://dev.scms.example.com/auth/bluesky/client-metadata" | jq .
curl -sS "https://dev.scms.example.com/auth/bluesky/jwks" | jq .
```

You should see JSON (metadata includes `redirect_uris` matching `redirectUrl`).

## 8. Test Bluesky login

Use **Sign in with Bluesky** (or link account) in the UI at the **tunnel URL**. Complete the flow on `bsky.social` and confirm you return to `/auth/bluesky/callback` on your dev host.

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| Metadata 404 | Tunnel running; ingress port matches local dev server; path matches platform routes (`/auth/bluesky/...`). |
| Redirect mismatch | `redirectUrl` in YAML equals one of `redirect_uris` in client metadata; no typo in scheme/host. |
| Still on localhost in browser | Open the app only via `https://your-tunnel-hostname`, not `localhost`. |
| JWT / JWKS errors | `privateKeyPem` valid PEM; restart server after config change; single instance or shared stores if scaled. |

## Cloudflare dashboard

- **Tunnels**: [Cloudflare Zero Trust / Tunnels](https://one.dash.cloudflare.com/) (account → Networks → Tunnels).
- **DNS**: Your zone’s DNS records should show the tunnel CNAME for the dev hostname after `tunnel route dns`.

---

See also [README.md](./README.md) for general Bluesky provider configuration.
