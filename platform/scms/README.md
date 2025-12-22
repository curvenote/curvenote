# Curvenote SCMS App

This app is at https://sites.curvenote.com

## Local Development

Copy app-config files, .env into `platform/scms` folder. The app-config schema is committed at the top level of the monorepo, but you will need to edit this to add extensions and fix relative paths, under the `extensions` section (this should just be adding `../..`).

Then at the top level of the monorepo:

```
npm install
```

This installs all the workspace dependencies and the `postinstall` step generates `@prisma/client` and the `platform/scms` package.json with extensions, as well as the `client.ts`/`server.ts` files in the scms extensions source folder.

Still at the top level:

```
npm run build
```

Then in the `platform/scms` folder, to install, build, and run locally:

```
npm install
npm run build
npm run dev
```

### First-time setup

A local Postgres database is used for local development. This enabled flexible seeding, migration and mutation without affecting other developers.

- [Setup Postgres on MacOS](https://www.prisma.io/dataguide/postgresql/setting-up-a-local-postgresql-database#setting-up-postgresql-on-macos)

Note: downloading and running the installer gets you the server, cli tools and admin tools.

#### DB Creation and Setup

Only needed first time around.

```
sudo -u postgres createuser journals
```

```
sudo -u postgres createdb journals
sudo -u postgres createdb journals_test
```

```
psql -U postgres -d journals -a -f ./prisma/setup-dev-db.sql
psql -U postgres -d journals_test -a -f ./prisma/setup-test-db.sql
```

For local dev use the password `curvenote`.

### Environment

Make two copies of the `.env.sample` file, called `.env.development` and `.env.test`. (Update the `DATABASE_URL` in each with the respective database connect string `journals` for `development` and `journals_test` for `test`.)

Add your firebase config and secrets to both.

### Seed

To reset and seed the database for **initial** development work

```
npm run dev:db:reset
npm run dev:db:migrate
```

To only format the schema

```
npx prisma format
```

or

```
npm run prisma:format
```

### Development with https

Some development work might need you to run with https locally e.g. ORCID OAuth2 flows. The easiest way to do this is using `caddy`, install caddy on mac using:

```
brew install caddy
```

We have a `Caddyfile` in the repository, so after that run:

```
sudo caddy start
```

And in a separate terminal run the dev server:

```
npm run dev
```

The platform will now be available at:

- http://localhost:3031
- https://127.0.0.1

### Testing

Tests use the `journals_test` database. This is seeded using a different script (`prisma/seed.test.ts`) and can be reset using `npm run test:db:reset`.

Use `npm run test:start` and `npm run test:local` to ensure that tests are started with the correct environment.

## JWT Integration for External Services

The platform provides JWT-based authentication for external service integration. This allows remote services to verify signed tokens issued by our API and enables secure web-hook callbacks and API integrations.

### Overview

- **Algorithm**: RS256 (RSA with SHA-256)
- **Key Format**: JSON Web Key (JWK) per RFC 7517
- **Public Endpoint**: `/v1/keys` serves JWKS for token verification
- **Key Rotation**: Supported via `kid` (Key ID) field

### Configuration Requirements

The JWT integration requires configuration in both the main config and secrets files:

#### Main Config (`.app-config.yml`)

Add to the `api` section:

```yaml
api:
  integrations:
    issuer: https://your-domain.com/v1
    tokenExpiryDuration: 1m
    publicKey:
      kty: RSA
      n: <public key modulus>
      e: AQAB
      use: sig
      alg: RS256
      kid: integration-key-2025-01
```

#### Secrets Config (`.app-config.secrets.yml`)

Add to the `api` section:

```yaml
api:
  integrations:
    privateKey:
      kty: RSA
      n: <same public key modulus>
      e: AQAB
      d: <private key>
      p: <prime factor p>
      q: <prime factor q>
      dp: <d mod (p-1)>
      dq: <d mod (q-1)>
      qi: <q^-1 mod p>
      use: sig
      alg: RS256
      kid: integration-key-2025-01
```

### Generating JWK Keys

To generate new JWK keys for deployment or key rotation, use the provided script:

```bash
# Generate new JWK keys
npm run generate:jwk-keys

# Or run directly
node scripts/generate-jwk-keys.mjs
```

This script will output properly formatted YAML that you can copy directly into your configuration files. The script generates secure 2048-bit RSA keys and includes all necessary JWK fields with a date-based key ID.

### Key Rotation

To rotate JWT keys:

1. **Generate new keys** using `npm run generate:jwk-keys` (automatically generates new `kid` with current date)
2. **Update configuration** with the new keys in both config files
3. **Deploy** the updated configuration
4. **Monitor** external services to ensure they fetch the new public key from `/v1/keys`
5. **Verify** that old tokens are properly rejected after expiry

**Important**: The `kid` field must match between the public and private keys. The generation script automatically creates date-based key IDs (e.g., `integration-key-2025-08-05`).

### External Service Integration

External services can retrieve the public key and verify JWTs using:

```bash
# Fetch public keys
curl https://your-domain.com/v1/keys

# Response format (JWKS):
{
  "keys": [
    {
      "kty": "RSA",
      "n": "...",
      "e": "AQAB",
      "use": "sig",
      "alg": "RS256",
      "kid": "integration-key-2025-01"
    }
  ]
}
```

### Usage Example

```typescript
// Create a token for a specific external service
const token = await createIntegrationToken(
  ctx,
  'external-service-id',
  'https://partner-service.com/api/webhook',
  {
    customClaims: { 
      permissions: ['read', 'write'],
      service_type: 'webhook'
    },
    expiryOverride: '5m'
  }
);

// Verify a token (optionally checking audience)
const claims = await verifyIntegrationToken(ctx, token, 'expected-audience');
```
### Security Notes

- **Never commit private keys** to version control
- **Use different keys** for different environments (dev/staging/production)
- **Rotate keys regularly** (recommended: every 90 days)
- **Monitor the `/v1/keys` endpoint** for unusual access patterns
- **Update issuer URLs** to match your production domain

