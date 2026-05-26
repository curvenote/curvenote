# Configuration

## `knownBucketInfoMap`

Always defined under **`api`**. Maps each logical bucket (**`KnownBuckets`**) to **`uri`** (provider bucket/container name) and optional **`cdn`** base URL.

```yaml
api:
  knownBucketInfoMap:
    cdn:       { uri: cdn-dev-1, cdn: https://cdn.example.com }
    pub:       { uri: cdn-pub-dev-1, cdn: https://pub.example.com }
    prv:       { uri: cdn-private-dev-1, cdn: https://prv.example.com }
    tmp:       { uri: cdn-tmp-dev-1, cdn: https://tmp.example.com }
    hashstore: { uri: hashstore-dev-1 }
    staging:   { uri: staging-dev-1 }
```

**`uri`** means: GCS bucket name, Azure container name, or S3 bucket name (in the configured region).

## `api.storage` (explicit provider)

```yaml
api:
  storage:
    provider: gcs   # or azure | s3

    gcs:
      secretKeyfile: '{"type":"service_account",...}'

    azure:
      accountName: mystorageaccount
      accountKey: '...'
      # or connectionString: 'DefaultEndpointsProtocol=https;...'

    s3:
      region: us-east-1
      accessKeyId: AKIA...
      secretAccessKey: ...
```

**Schema:** `/.app-config.schema.yml` under **`api.properties.storage`** — `provider` enum, nested **`gcs`**, **`azure`**, **`s3`** with secret fields marked **`secret: true`**.

## Legacy GCS-only

```yaml
api:
  storageSASecretKeyfile: '{"type":"service_account","project_id":...}'
  knownBucketInfoMap: { ... }
```

**Resolution order** (`resolveStorageConfig`):

1. If **`api.storage.provider`** is set → use **`api.storage`**.
2. Else if **`storageSASecretKeyfile`** is set → **`{ provider: 'gcs', gcs: { secretKeyfile } }`**.
3. Else → no storage config (**`StorageBackend`** constructor throws unless handled).

**`storageSASecretKeyfile`** is optional in the schema when **`api.storage`** is used.

## Examples

### GCS (explicit)

```yaml
api:
  storage:
    provider: gcs
    gcs:
      secretKeyfile: '{"type":"service_account","project_id":"my-project",...}'
```

### Azure

```yaml
api:
  storage:
    provider: azure
    azure:
      accountName: curvenotestorage
      accountKey: '...'
  knownBucketInfoMap: { ... }
```

### S3

```yaml
api:
  storage:
    provider: s3
    s3:
      region: us-east-1
      accessKeyId: AKIA...
      secretAccessKey: ...
  knownBucketInfoMap: { ... }
```

### Legacy (unchanged)

```yaml
api:
  storageSASecretKeyfile: '{"type":"service_account",...}'
  knownBucketInfoMap: { ... }
```

## Multiple named providers (not implemented)

A possible evolution for migration windows:

```yaml
api:
  storage:
    providers:
      main: { provider: azure, azure: { ... } }
      legacy: { provider: gcs, gcs: { ... } }
    active: main
```

The shipped code uses a **single** **`storage.provider`** + **`storage.<name>`** credential block. See [09-migration-extension.md](./09-migration-extension.md) for the conceptual design.
