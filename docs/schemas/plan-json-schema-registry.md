# Plan: Central AJV-based JSON Schema Registry

## Goal

Establish an in-code JSON Schema registry in `scms-server` backed by [AJV](https://ajv.js.org/) (Another JSON Validator). This gives us:

1. **A single place** to define, version, and look up JSON Schemas for every JSON column managed via OCC.
2. **Runtime validation** of data going _into_ and coming _out of_ those columns, using compiled AJV validators.
3. **Self-describing data** — every stored JSON blob carries a `$schema` key that points back to a registry entry, so any reader (UI, CLI, extension) can discover the shape of the data it's looking at.
4. **Language-agnostic contracts** — JSON Schema is the source of truth for model data shapes. Extensions in Python or other languages can consume the same schemas. Zod continues to be used separately for form validation, API request parsing, and other TypeScript-specific concerns, but is _not_ involved in defining model-data schemas.

## Terminology

| Term | Meaning |
|---|---|
| **JSON Schema** | A plain JSON object conforming to JSON Schema 2020-12 |
| **Schema ID** | A URN string, e.g. `urn:curvenote:scms:work-version-metadata:1-0-0` |
| **Registry** | A singleton AJV instance; map of Schema ID → compiled `ValidateFunction` |

## Relationship to Zod

Zod and the JSON Schema registry serve **different purposes** and operate in **different layers**:

| Concern | Tool | Where |
|---|---|---|
| API request body validation | Zod | Co-located in API route files |
| Form data validation (zfd) | Zod | Co-located in app route files |
| Model-data JSON field shapes | **JSON Schema + AJV** | `schemas/` registry |
| TypeScript types for model data | Derived from JSON Schema via `json-schema-to-ts` (or hand-written) | `schemas/` |

The existing Zod schemas in `schemas/work-version/checks.ts` and `schemas/files.ts` will be **replaced** by JSON Schema definitions registered with AJV. The Zod usages in the upload UI (`ChecksMetadataSchema.safeParse()`) will be migrated to use the registry's `validate()` function instead.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  packages/scms-server/src/schemas/                   │
│                                                      │
│   registry.ts         ← AJV singleton + helpers      │
│   $id.ts              ← schema ID constants          │
│                                                      │
│   files.ts            ← JSON Schema definitions      │
│   work-version/                                      │
│     checks.ts         ← JSON Schema definitions      │
│     index.ts          ← composite schema + TS types  │
│   ...future model schema files...                    │
└──────────────┬───────────────────────────────────────┘
               │
               ▼  registers into
┌──────────────────────────────────────┐
│  AJV instance (singleton)            │
│                                      │
│  schemaId → ValidateFunction         │
│  schemaId → JSON Schema object       │
└──────────────────────────────────────┘
               │
               ▼  used by
┌──────────────────────────────────────┐
│  occ.server.ts                       │
│  safeJsonUpdateGeneric()             │
│    → validate before write           │
│    → stamp $schema on data           │
│                                      │
│  App route loaders/actions           │
│    → validate on read (optional)     │
│    → validate sections before write  │
└──────────────────────────────────────┘
```

## Design Decisions

### JSON Schema is the source of truth for model data

Model-data schemas are written directly as JSON Schema objects — not derived from Zod. This means:

- The schema is exactly what gets stamped on the data as `$schema` and what gets served to external consumers.
- No translation layer or impedance mismatch between what's authored and what's stored.
- Extensions (potentially in any language) author and consume the same format.
- AJV features like `$ref`, `allOf`, `additionalProperties`, `if/then` are used directly, not constrained by what Zod can express.

### TypeScript types alongside JSON Schema

We still need TypeScript types for the server code that reads/writes these fields. Two options:

1. **`json-schema-to-ts`** — derives TS types from `as const` JSON Schema objects at compile time. Zero runtime cost, but the JSON Schema must be `as const`-compatible.
2. **Hand-written interfaces** — simpler, more readable, manually kept in sync.

For now, **hand-written interfaces** (which we already have, e.g. `WorkVersionMetadata`) alongside the JSON Schema definitions. We can evaluate `json-schema-to-ts` later if drift becomes a problem.

### AJV for runtime validation

AJV compiles JSON Schema into optimised validator functions at startup:

- Language-agnostic — the same schemas work in Python, Go, etc.
- Handles `$ref`, `allOf`, composition natively.
- Compiled validators are fast for hot paths (OCC retry loops).
- Rich error output with `allErrors: true`.

### Schema IDs use URN format

Following the pattern already established in `FOLLOW_ON_JSON_SCHEMA`:

```
urn:curvenote:scms:<scope>:<semver>
```

Examples:
- `urn:curvenote:scms:file-metadata-section:1-0-0`
- `urn:curvenote:scms:checks-metadata-section:1-0-0`
- `urn:curvenote:scms:work-version-metadata:1-0-0`

The version is embedded in the ID so that old data with `$schema.$id = "...:1-0-0"` remains self-describing even after the registry ships `2-0-0`.

### Composite schemas with `allOf`

`WorkVersion.metadata` is composed of multiple sections (files, checks, extension-contributed keys). The registry schema uses JSON Schema `allOf` to merge sections, plus `additionalProperties: true` to allow extension keys:

```json
{
  "$id": "urn:curvenote:scms:work-version-metadata:1-0-0",
  "allOf": [
    { "$ref": "urn:curvenote:scms:file-metadata-section:1-0-0" },
    { "$ref": "urn:curvenote:scms:checks-metadata-section:1-0-0" }
  ],
  "additionalProperties": true
}
```

Sub-schemas are registered separately so they can be validated independently (e.g. the checks UI validates just the checks section).

### `$schema` field on stored data

When an OCC write succeeds, the `$schema` key on the stored JSON object is set to the full JSON Schema object (matching the existing convention in `FOLLOW_ON_JSON_SCHEMA` and `message-schemas.ts`). This makes every stored blob self-describing.

On _read_, consumers ignore `$schema` — it's metadata for introspection, not application data.

## New Dependencies

| Package | Purpose |
|---|---|
| `ajv` | JSON Schema 2020-12 validation engine |

Single dependency. Install in `packages/scms-server`.

(`json-schema-to-ts` is optional — only needed if we want to derive TS types from the schemas automatically.)

## Implementation Steps

### Step 0 — Install dependency

```bash
cd packages/scms-server
npm install ajv
```

### Step 1 — Create `schemas/$id.ts`

Central place for all schema ID constants:

```ts
// Schema ID constants — URN format: urn:curvenote:scms:<scope>:<semver>

export const SCHEMA_IDS = {
  FILE_METADATA_ITEM: 'urn:curvenote:scms:file-metadata-item:1-0-0',
  FILE_METADATA_SECTION: 'urn:curvenote:scms:file-metadata-section:1-0-0',
  CHECKS_METADATA_SECTION: 'urn:curvenote:scms:checks-metadata-section:1-0-0',
  WORK_VERSION_METADATA: 'urn:curvenote:scms:work-version-metadata:1-0-0',
} as const;

export type SchemaId = (typeof SCHEMA_IDS)[keyof typeof SCHEMA_IDS];
```

### Step 2 — Create `schemas/registry.ts`

```ts
import Ajv from 'ajv';

// Singleton AJV instance — all schemas registered here
const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Register a JSON Schema and compile its validator.
 * The schema must have a $id field.
 */
export function registerSchema(schema: Record<string, any>): void {
  ajv.addSchema(schema);
}

/**
 * Look up the compiled validator for a registered schema ID.
 */
export function getValidator(id: string) {
  const validate = ajv.getSchema(id);
  if (!validate) throw new Error(`Schema not registered: ${id}`);
  return validate;
}

/**
 * Look up a registered schema object by $id.
 */
export function getSchemaObject(id: string): Record<string, any> | undefined {
  const v = ajv.getSchema(id);
  return v?.schema as Record<string, any> | undefined;
}

/**
 * Validate data against a registered schema ID.
 * Returns { valid: true } or { valid: false, errors: string }.
 */
export function validateData(
  id: string,
  data: unknown,
): { valid: true } | { valid: false; errors: string } {
  const validate = getValidator(id);
  if (validate(data)) return { valid: true };
  const errors = (validate.errors ?? [])
    .map((e) => `${e.instancePath || '/'}: ${e.message}`)
    .join('; ');
  return { valid: false, errors };
}
```

### Step 3 — Define FileMetadata schemas (JSON Schema, replacing Zod)

Replace the contents of `schemas/files.ts`. The Zod re-exports from scms-core are removed from this file — scms-core's Zod schemas continue to exist for the upload UI component that lives in scms-core, but the _registry_ definitions are pure JSON Schema:

```ts
import { registerSchema } from './registry.js';
import { SCHEMA_IDS } from './$id.js';

/**
 * A single file entry in WorkVersion.metadata.files
 */
export const FileMetadataItemSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: SCHEMA_IDS.FILE_METADATA_ITEM,
  type: 'object',
  required: ['name', 'size', 'type', 'path', 'md5', 'uploadDate', 'slot'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    size: { type: 'number' },
    type: { type: 'string' },
    path: { type: 'string' },
    md5: { type: 'string' },
    uploadDate: { type: 'string' },
    slot: { type: 'string' },
    label: { type: 'string', maxLength: 100 },
    order: { type: 'integer', minimum: 1 },
    signedUrl: { type: 'string' },
  },
} as const;

/**
 * The files section of WorkVersion.metadata: { files: { [path]: FileMetadataItem } }
 */
export const FileMetadataSectionSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: SCHEMA_IDS.FILE_METADATA_SECTION,
  type: 'object',
  properties: {
    files: {
      type: 'object',
      additionalProperties: { $ref: SCHEMA_IDS.FILE_METADATA_ITEM },
    },
  },
  additionalProperties: true,
} as const;

// Register both schemas
registerSchema(FileMetadataItemSchema);
registerSchema(FileMetadataSectionSchema);

// TS types (hand-written to match the JSON Schema)
export type FileMetadataItem = {
  name: string;
  size: number;
  type: string;
  path: string;
  md5: string;
  uploadDate: string;
  slot: string;
  label?: string;
  order?: number;
  signedUrl?: string;
};

export type FileMetadataSection = {
  files?: Record<string, FileMetadataItem>;
};
```

**Note:** The Zod schemas in `@curvenote/scms-core` (`FileBaseSchema`, `FileMetadataSectionItemSchema`, etc.) continue to exist — they are used by `WorkFileUpload.tsx` (a UI component in scms-core) for client-side form validation. The JSON Schema registry is the server-side source of truth for what gets stored.

### Step 4 — Define Checks schemas (JSON Schema, replacing Zod)

Replace `schemas/work-version/checks.ts`:

```ts
import { registerSchema } from '../registry.js';
import { SCHEMA_IDS } from '../$id.js';

export const ChecksMetadataSectionSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: SCHEMA_IDS.CHECKS_METADATA_SECTION,
  type: 'object',
  properties: {
    checks: {
      type: 'object',
      properties: {
        enabled: {
          type: 'array',
          items: { type: 'string' },
          uniqueItems: true,
          default: [],
        },
        'curvenote-structure': {
          type: 'object',
          properties: {
            dispatched: { type: 'boolean', default: false },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: true,
} as const;

registerSchema(ChecksMetadataSectionSchema);

// TS types
export type CheckStatus = { dispatched?: boolean };
export type ChecksObject = {
  enabled?: string[];
  'curvenote-structure'?: CheckStatus;
};
export type ChecksMetadata = {
  checks?: ChecksObject;
};

// Helper (replaces isValidCheckName — now just a string check, no Zod)
export function isValidCheckName(name: unknown): name is string {
  return typeof name === 'string' && name.length > 0;
}
```

**Migration note:** The app routes that currently call `ChecksMetadataSchema.safeParse()` will be updated to use `validateData(SCHEMA_IDS.CHECKS_METADATA_SECTION, data)` from the registry instead. This affects:
- `platform/scms/app/routes/app/works.$workId.upload.$workVersionId/route.tsx`
- `platform/scms/app/routes/app/works.$workId.upload.$workVersionId/updateChecks.server.ts`

Note that `uniqueItems: true` in JSON Schema replaces the Zod `.refine()` that checked for duplicate check names — AJV handles this natively.

### Step 5 — Define the composite WorkVersion.metadata schema

Update `schemas/work-version/index.ts`:

```ts
import { registerSchema } from '../registry.js';
import { SCHEMA_IDS } from '../$id.js';

// Ensure sub-schemas are registered first (side-effect imports)
import '../files.js';
import './checks.js';

// Re-export sub-schema types
export * from './checks.js';
export type { FileMetadataItem, FileMetadataSection } from '../files.js';

/**
 * Composite schema for the full WorkVersion.metadata JSON field.
 * Composed from file + checks sections, open to extension keys.
 */
export const WorkVersionMetadataSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: SCHEMA_IDS.WORK_VERSION_METADATA,
  description: 'Composite schema for WorkVersion.metadata JSON field',
  allOf: [
    { $ref: SCHEMA_IDS.FILE_METADATA_SECTION },
    { $ref: SCHEMA_IDS.CHECKS_METADATA_SECTION },
  ],
  additionalProperties: true,
} as const;

registerSchema(WorkVersionMetadataSchema);

// TS type (composite)
import type { FileMetadataSection } from '../files.js';
import type { ChecksMetadata } from './checks.js';

export type WorkVersionMetadata = {
  [key: string]: any;       // extension keys + $schema
} & FileMetadataSection
  & ChecksMetadata;

export function makeDefaultWorkVersionMetadata(): WorkVersionMetadata {
  return {};
}
```

### Step 6 — Stamp `$schema` on OCC writes

Modify `occ.server.ts` to optionally validate and stamp:

```ts
import { validateData, getSchemaObject } from '../schemas/registry.js';
import { SCHEMA_IDS } from '../schemas/$id.js';

// Add optional schemaId to modelConfig:
const modelConfig = {
  workVersion: {
    table: 'workVersion' as const,
    metadataField: 'metadata' as const,
    occField: 'occ' as const,
    errorPrefix: 'WorkVersion',
    schemaId: SCHEMA_IDS.WORK_VERSION_METADATA as string | undefined,
  },
  submissionVersion: {
    // ...existing...
    schemaId: undefined,  // not yet registered
  },
  // ...etc for other models...
};
```

In `safeJsonUpdateGeneric`, after `modifyFn` returns:

```ts
const newMetadata = modifyFn(currentRecord[config.metadataField]);
if (!newMetadata) return currentRecord;

// Validate + stamp if schema is registered for this model
if (config.schemaId) {
  const result = validateData(config.schemaId, newMetadata);
  if (!result.valid) {
    throw httpError(400, `${config.errorPrefix} validation failed: ${result.errors}`);
  }
  newMetadata.$schema = getSchemaObject(config.schemaId);
}
```

Same change in `safeJsonUpdateGenericAsync`.

### Step 7 — Migrate app route consumers

Update the two files that currently import Zod checks schemas:

**`route.tsx`** — replace:
```ts
// Before
import { ChecksMetadataSchema } from '@curvenote/scms-server';
const checksResult = ChecksMetadataSchema.safeParse(rawMetadata);
```
```ts
// After
import { validateData, SCHEMA_IDS } from '@curvenote/scms-server';
const checksResult = validateData(SCHEMA_IDS.CHECKS_METADATA_SECTION, rawMetadata);
```

**`updateChecks.server.ts`** — same pattern, replace `.safeParse()` with `validateData()`.

The return shape changes from Zod's `{ success, data, error }` to `{ valid, errors }`, so the consuming code adjusts accordingly.

### Step 8 — Handle `$schema` on reads

No special handling needed. The `$schema` key is just another property on the JSON object. TypeScript types use `[key: string]: any` so it flows through. Consumers that don't care about it ignore it. Consumers that want to introspect read `data.$schema.$id`.

### Step 9 — Export from package index

Update `schemas/index.ts`:

```ts
export * from './registry.js';
export * from './$id.js';
export * from './files.js';
export * from './work-version/index.js';
```

### Step 10 — Tests

Add tests in `packages/scms-server/src/schemas/__tests__/`:

1. **registry.test.ts** — `registerSchema` + `validateData` pass/fail correctly, `getSchemaObject` returns the registered schema
2. **files.test.ts** — valid file metadata passes, missing required fields fail, extra properties fail on item (strict), pass on section (open)
3. **work-version.test.ts** — composite validates data with files + checks + unknown extension keys; rejects invalid file entries; `uniqueItems` rejects duplicate check names

## Applying to FileMetadata (first example, end-to-end)

Here is the concrete sequence for FileMetadata on WorkVersion:

1. `FileMetadataItemSchema` and `FileMetadataSectionSchema` are defined as JSON Schema objects in `schemas/files.ts` and registered with AJV on import
2. `schemas/work-version/index.ts` imports `files.ts` (triggering registration), then registers the composite `WorkVersionMetadataSchema` that references the file section via `$ref`
3. When `safeWorkVersionJsonUpdate()` is called (e.g. after a file upload), the new metadata is:
   - Validated against `urn:curvenote:scms:work-version-metadata:1-0-0` via AJV — this transitively validates the files section
   - Stamped with `$schema: { $id: "urn:curvenote:scms:work-version-metadata:1-0-0", ... }`
   - Written to the DB via OCC
4. When the upload page loads, the raw metadata comes back with `$schema` attached — TypeScript types ignore it, the checks UI reads `metadata.checks` as before
5. A future admin/debug UI or extension could read `metadata.$schema.$id` to discover the shape and version of the data

## What happens to the existing Zod schemas?

| File | Current | After |
|---|---|---|
| `scms-core: uploads/schema.ts` | Zod: `FileBaseSchema`, `FileMetadataSectionItemSchema`, etc. | **Stays** — used by `WorkFileUpload.tsx` UI component for client-side validation |
| `scms-server: schemas/files.ts` | Re-exports Zod from scms-core | **Replaced** — JSON Schema definitions + TS types |
| `scms-server: schemas/work-version/checks.ts` | Zod: `ChecksMetadataSchema`, etc. | **Replaced** — JSON Schema definitions + TS types |
| `scms-server: schemas/work-version/index.ts` | TS types + `makeDefault` | **Updated** — registers composite, keeps types |
| App routes: `route.tsx`, `updateChecks.server.ts` | `ChecksMetadataSchema.safeParse()` | **Migrated** — uses `validateData()` from registry |

## Future Work (out of scope for this plan)

- Register schemas for remaining OCC models (SubmissionVersion, SubmissionKind, Object, CheckServiceRun, Site)
- Schema migration tooling — when bumping from `1-0-0` to `2-0-0`, backfill existing rows
- Extension schema registration — extensions declare their own sub-schemas that get composed into the composite via `allOf`
- API endpoint to serve schemas (e.g. `GET /api/v1/schemas/:id`) for external consumers
- `json-schema-to-ts` to derive TypeScript types from the `as const` schema objects, removing hand-written type duplication
- CLI command to dump all registered schemas as `.json` files for documentation
