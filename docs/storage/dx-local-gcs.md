# Local GCS (fake-gcs-server)

Use [fake-gcs-server](https://github.com/fsouza/fake-gcs-server) so the SCMS app talks to local buckets instead of production GCS.

## 1. Start the emulator

From the repo root:

```bash
docker compose -f docker-compose.gcs.yml up -d
```

This maps **HTTP** port **4443** and loads buckets from [`dev/fake-gcs-data`](../dev/fake-gcs-data). Each top-level folder name becomes a bucket; names must match `api.knownBucketInfoMap.*.uri` in app-config (e.g. `hashstore-curvenote-dev-1`).

## 2. Environment (`platform/scms/.env.development`)

Uncomment or add:

```bash
STORAGE_EMULATOR_HOST=http://127.0.0.1:4443
GCS_SIGNED_URL_ORIGIN=http://127.0.0.1:4443
```

`STORAGE_EMULATOR_HOST` routes `@google-cloud/storage` API calls to the emulator. `GCS_SIGNED_URL_ORIGIN` rewrites signed read/upload URLs so the **browser** does not hit `storage.googleapis.com` (required for uploads; see fake-gcs-server README on signed URLs).

If list/get returns 404 for the JSON API, try adjusting `STORAGE_EMULATOR_HOST` per your `@google-cloud/storage` version (some setups expect a `/storage/v1` suffix).

## 3. App config

- **Secrets** ([`.app-config.secrets.development.yml`](../../platform/scms/.app-config.secrets.development.yml)): `api.storage.provider: gcs` and `api.storage.gcs.secretKeyfile` (service account JSON). The library needs a real key to **generate** signed URL strings; the emulator does not validate signatures like production.
- **Non-secret** ([`.app-config.development.yml`](../../platform/scms/.app-config.development.yml)): `api.knownBucketInfoMap` — keep `uri` values aligned with bucket folders under `dev/fake-gcs-data`. Keep `cdn` values consistent with your database so `knownBucketFromCDN` keeps working.

## 4. Stop

```bash
docker compose -f docker-compose.gcs.yml down
```
