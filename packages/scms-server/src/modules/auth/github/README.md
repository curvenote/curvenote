# GitHub OAuth authentication

This module adds GitHub as an OAuth 2.0 sign-in provider, supporting **sign-in**, **sign-up**, and **account linking** when enabled in app config.

## Enabling GitHub authentication

1. **Add GitHub to the app-config schema**  
   The root `.app-config.schema.yml` already includes a `github` provider under `auth`. No schema change is required unless you need to add fields.

2. **Create a GitHub OAuth App** (see below) and add the credentials to your app config.

3. **Configure behaviour** in your deployment config (e.g. `.app-config.development.yml` and `.app-config.secrets.development.yml`):

   - `allowLogin: true` – show “Sign in with GitHub” on the login page.
   - `allowLinking: true` – allow users to link a GitHub account in settings.
   - `provisionNewUser: true` – allow new users to sign up with GitHub (creates a user when they don’t exist).

## Getting GitHub OAuth credentials

To get a **Client ID** and **Client Secret** for your application:

1. **Sign in to GitHub** and go to **Settings** → **Developer settings** → **OAuth Apps**:  
   [https://github.com/settings/developers](https://github.com/settings/developers)

2. **Create an OAuth App** (or use an existing one):
   - **Application name**: e.g. “My SCMS (Development)” or your deployment name.
   - **Homepage URL**: your app’s public URL (e.g. `https://myscms.example.com` or `http://localhost:3031` for local dev).
   - **Authorization callback URL**: must match exactly what your app uses:
     - Production: `https://<your-host>/auth/github/callback`
     - Local: `http://localhost:3031/auth/github/callback` (or the port your app uses).

3. After creating the app, GitHub shows:
   - **Client ID** – use this in config as `auth.github.clientId`.
   - **Client secret** – generate one if needed, then set it as `auth.github.clientSecret` (preferably in a secrets file).

4. **Put the values in app config**:
   - In the main config (e.g. `.app-config.development.yml`) set `auth.github.clientId` and `auth.github.redirectUrl` (and other options like `allowLogin`, `allowLinking`, `provisionNewUser`).
   - Put `auth.github.clientSecret` in your secrets config (e.g. `.app-config.secrets.development.yml`) so it is not committed.

## Example app-config

**Main config** (e.g. `.app-config.development.yml`):

```yaml
auth:
  github:
    displayName: GitHub
    clientId: your-github-oauth-client-id
    redirectUrl: http://localhost:3031/auth/github/callback
    allowLogin: true
    allowLinking: true
    provisionNewUser: true
    adminLogin: false
```

**Secrets config** (e.g. `.app-config.secrets.development.yml`):

```yaml
auth:
  github:
    clientSecret: your-github-oauth-client-secret
```

## Callback URL and redirect URI

The **Authorization callback URL** in the GitHub OAuth App and the **redirectUrl** in your app config must match:

- Same scheme (`http` vs `https`).
- Same host and port.
- Path must be: `/<base-path-if-any>/auth/github/callback`.

For example, if your app is at `http://localhost:3031`, use:

- In GitHub OAuth App: `http://localhost:3031/auth/github/callback`
- In config: `redirectUrl: http://localhost:3031/auth/github/callback`

## Email requirement for new users

GitHub does not always expose the user’s email. For **new sign-ups** (provisioning), the app requires an email:

- If GitHub does not return an email, the user is redirected to an error page asking them to add or make visible a public email in their GitHub profile, then try again.
- Existing users (sign-in or account linking) can have no email from GitHub; their profile is updated as-is.

New users who sign up via GitHub and have no email will also be asked for email (and other details) in the signup data-collection step, consistent with other providers (e.g. ORCID).

## Scopes

The strategy requests the scopes `user` and `user:email` so the app can read profile and email. No repository or other scopes are required for sign-in/sign-up/linking.
