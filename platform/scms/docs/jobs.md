# SCMS Jobs – Developer guide

This document describes how jobs work in SCMS, how to use **job chaining** (follow-on jobs), and how to add new job types (core or extension). It is intended for developers working on the platform or writing extensions.

**Contents**

- [How jobs work](#how-jobs-work) – Create, run (sync/async), update, read
- [API reference](#api-reference) – Request/response for `POST` and `PATCH`
- [Job chaining](#job-chaining) – Follow-on jobs: request shape, example, and using `buildFollowOnEnvelope` in code
- [Adding a new job (core)](#adding-a-new-job-core-job-in-scms) – Steps and file reference
- [Extension jobs](#extension-jobs-no-change-to-core-names) – Add jobs without changing core

---

## How jobs work

1. **Create**  
   The app (or any authenticated client) sends `POST /api/v1/jobs` with `{ job_type, payload }` (and optionally `follow_on` for chaining).  
   The API validates `job_type` and `payload`, looks up the handler for that type, runs the handler, and returns the created job DTO. The handler is responsible for creating the job row (and optionally enqueueing an async task).

2. **Run**
   - **Sync**: The handler does all work and updates the job (e.g. PUBLISH, UNPUBLISH).
   - **Async**: The handler creates the job, publishes a message (e.g. SNS/PubSub) with a handshake token and `job_url`, and returns. A worker consumes the message, does the work, and updates the job via `PATCH /api/v1/jobs/:jobId` using the handshake token (e.g. CHECK, CONVERTER_TASK).

3. **Update**  
   `PATCH /api/v1/jobs/:jobId` with `{ status, message?, results? }` is allowed only when authorized by Curvenote auth or by a valid handshake token whose `jobId` claim matches the route param. Used by async workers to set COMPLETED/FAILED and attach results.

4. **Read**  
   `GET /api/v1/jobs/:jobId` returns the job DTO (payload, results, status, messages, links).

---

## API reference

### Create job – `POST /api/v1/jobs`

**Request body**

| Field       | Type   | Required | Description                                                           |
| ----------- | ------ | -------- | --------------------------------------------------------------------- |
| `job_type`  | string | yes      | Registered job type (e.g. `CHECK`, `CONVERTER_TASK`).                  |
| `payload`   | object | yes      | Parameters for the job.                                               |
| `id`        | string | no       | UUID for the job; server generates one if omitted.                    |
| `results`   | object | no       | Pre-populated results (rare).                                         |
| `follow_on` | object | no       | Optional follow-on job spec; see [Job chaining](#job-chaining) below. |

**Example (no chaining)**

```json
{
  "job_type": "CONVERTER_TASK",
  "payload": { "target": "pdf", "work_version_id": "..." }
}
```

**Response:** `201` with job DTO (`id`, `date_created`, `job_type`, `status`, `payload`, `results`, `messages`, `links`).

### Update job – `PATCH /api/v1/jobs/:jobId`

**Request body**

| Field     | Type   | Required | Description                                                      |
| --------- | ------ | -------- | ---------------------------------------------------------------- |
| `status`  | string | yes      | One of: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`. |
| `message` | string | no       | Appended to job messages.                                        |
| `results` | object | no       | Job results (e.g. for CHECK, CONVERTER_TASK).                     |

**Authorization:** Curvenote auth or handshake token whose `jobId` claim matches `:jobId`.  
**Response:** `200` with updated job DTO. The route rejects PATCH when the job is already `COMPLETED` or `FAILED`.

---

## Job chaining

Job chaining lets you run a **follow-on job** automatically when the first job completes successfully. You specify the follow-on at **create time**; the server creates it when the first job is updated to `COMPLETED` via `PATCH`. There is no follow-on on failure.

- **Who triggers the follow-on:** The server. When a client (e.g. an async worker) calls `PATCH /api/v1/jobs/:jobId` with `status: "COMPLETED"`, the update handler runs and, if the job has a valid `follow_on`, creates the follow-on job. Handlers do not need to check for or invoke follow-ons.
- **Sync jobs:** Follow-on is only triggered when the job is completed via the **PATCH** API. Sync handlers that never call PATCH do not trigger a follow-on in the current design.

### Request shape for `follow_on`

When creating a job, you may send an optional `follow_on` object. It must include:

- **`$schema`** – Inline JSON Schema document describing the `follow_on` shape (for validation and documentation). Stored with the job.
- **`on_success`** – The follow-on job spec:
  - **`job_type`** (string, required): A registered job type (e.g. `CHECK`, `PUBLISH`).
  - **`payload`** (object, required): The full payload for that job, as you would send in a normal `POST /api/v1/jobs` for that type.
  - **`id`** (string, optional): UUID for the follow-on job; server generates one if omitted.

**Example: create job with follow-on**

```json
{
  "job_type": "CONVERTER_TASK",
  "payload": { "target": "pdf", "work_version_id": "..." },
  "follow_on": {
    "$schema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "urn:curvenote:scms:job-follow-on:1-0-0",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "on_success": {
          "type": "object",
          "required": ["job_type", "payload"],
          "additionalProperties": false,
          "properties": {
            "job_type": { "type": "string" },
            "id": { "type": "string", "format": "uuid" },
            "payload": { "type": "object" }
          }
        }
      },
      "required": ["on_success"]
    },
    "on_success": {
      "job_type": "CHECK",
      "payload": {
        "submission_version_id": "abc-123",
        "checks": ["spelling"]
      }
    }
  }
}
```

### Using job chaining in code

- **Types:** `FollowOnSpec` and `FollowOnEnvelope` are in `@curvenote/scms-core` ([packages/scms-core/src/backend/loaders/jobs/types.ts](packages/scms-core/src/backend/loaders/jobs/types.ts)).
- **Building the envelope:** Use `buildFollowOnEnvelope(spec)` from `@curvenote/scms-core` ([packages/scms-core/src/backend/loaders/jobs/followOn.ts](packages/scms-core/src/backend/loaders/jobs/followOn.ts)) to build the full `follow_on` object (including `$schema`) from a `FollowOnSpec` (`{ job_type, payload, id? }`). Use this when creating jobs programmatically so you don’t hand-roll the `$schema` object.
- **Storage and idempotency:** The full `follow_on` (including `$schema`) is stored on the first job. When that job is PATCHed to `COMPLETED`, the server creates the follow-on job once; the PATCH route rejects further updates to terminal jobs, so the trigger runs at most once per job. The follow-on job can itself have a `follow_on` for further chaining.

---

## Adding a new job (core job in SCMS)

To add a job like **Export to PDF** that triggers an async task:

| Step | What                         | Where                                                                                                                                                                                                                              |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Declare job type constant    | [packages/scms-core/src/backend/loaders/jobs/names.ts](packages/scms-core/src/backend/loaders/jobs/names.ts) – add to `KnownJobTypes`                                                                                              |
| 2    | Allow type in API validation | [packages/scms-server/src/api.schemas.ts](packages/scms-server/src/api.schemas.ts) – add to `coreJobTypes` in `getJobTypes()`                                                                                                      |
| 3    | Define payload schema        | [packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts) – e.g. `CreateConverterTaskPayloadSchema`                                    |
| 4    | Implement handler            | [packages/scms-server/src/backend/loaders/jobs/handlers/converter-task.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/converter-task.server.ts) – validate payload, `dbCreateJob`, enqueue (e.g. SNS), return job |
| 5    | Register handler             | [packages/scms-server/src/backend/loaders/jobs/handlers/index.ts](packages/scms-server/src/backend/loaders/jobs/handlers/index.ts) – add to `coreHandlers`                                                                         |
| 6    | (Optional) Storage           | [packages/scms-server/src/backend/loaders/jobs/create.server.ts](packages/scms-server/src/backend/loaders/jobs/create.server.ts) – add job type to `jobsRequiringStorage` only if the handler needs `StorageBackend`               |

**Trigger from the app**: `POST /api/v1/jobs` with body `{ "job_type": "CONVERTER_TASK", "payload": { "work_version_id": "...", "target": "pdf" } }`.  
The route that receives this: [platform/scms/app/routes/api/v1.jobs.tsx](platform/scms/app/routes/api/v1.jobs.tsx).

**Async worker**: Publish a message that includes a handshake token (see [packages/scms-server/src/backend/sign.handshake.server.ts](packages/scms-server/src/backend/sign.handshake.server.ts)) and `job_url` (e.g. `{base}/api/v1/jobs/{id}`). The worker calls `PATCH job_url` with `Authorization: Bearer <handshake>` and `{ status, message?, results? }`. Reference: CHECK job in [packages/scms-server/src/backend/loaders/jobs/handlers/check.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/check.server.ts) and [packages/scms-server/src/backend/processing.server.ts](packages/scms-server/src/backend/processing.server.ts) (`publishCheck`).

---

## Extension jobs (no change to core names)

To add a job **without** touching `KnownJobTypes` or core handlers:

1. Implement a **ServerExtension** that provides **getJobs()** returning `JobRegistration[]`.  
   Type: [packages/scms-core/src/modules/extensions/types.ts](packages/scms-core/src/modules/extensions/types.ts) – `JobRegistration` = `{ jobType, handler, requiresStorageBackend? }`.

2. **Handler** has the same signature as core handlers:  
   `(ctx: Context, data: CreateJob, storageBackend?: StorageBackend) => Promise<any>`; it must return the job DBO (e.g. from `dbCreateJob`).

3. Register the extension in the app’s extension list so it’s passed into `createJobPostBodySchema` and `jobs.create`.  
   App extensions: [platform/scms/app/extensions/server.ts](platform/scms/app/extensions/server.ts).  
   How extension jobs are merged: [packages/scms-server/src/modules/extensions/jobs.ts](packages/scms-server/src/modules/extensions/jobs.ts) (`registerExtensionJobs`).

4. Allowed job types for the API are then **core job types + extension job types** (see [packages/scms-server/src/api.schemas.ts](packages/scms-server/src/api.schemas.ts) – `getJobTypes`).

---

## File reference (links to touch for a new core job)

| Purpose                          | File                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job type constant                | [packages/scms-core/src/backend/loaders/jobs/names.ts](packages/scms-core/src/backend/loaders/jobs/names.ts)                                         |
| API allowed job types            | [packages/scms-server/src/api.schemas.ts](packages/scms-server/src/api.schemas.ts)                                                                   |
| Payload schema                   | [packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts) |
| Handler implementation           | New file under `packages/scms-server/src/backend/loaders/jobs/handlers/` (e.g. `export-to-pdf.server.ts`)                                            |
| Register handler                 | [packages/scms-server/src/backend/loaders/jobs/handlers/index.ts](packages/scms-server/src/backend/loaders/jobs/handlers/index.ts)                   |
| (Optional) Storage for job       | [packages/scms-server/src/backend/loaders/jobs/create.server.ts](packages/scms-server/src/backend/loaders/jobs/create.server.ts)                     |
| Create job API route             | [platform/scms/app/routes/api/v1.jobs.tsx](platform/scms/app/routes/api/v1.jobs.tsx)                                                                 |
| Get/update job API route         | [platform/scms/app/routes/api/v1.jobs.$jobId.tsx](platform/scms/app/routes/api/v1.jobs.$jobId.tsx)                                                   |
| Handshake token helpers          | [packages/scms-server/src/backend/sign.handshake.server.ts](packages/scms-server/src/backend/sign.handshake.server.ts)                               |
| Job DB helpers                   | [packages/scms-server/src/backend/loaders/jobs/handlers/db.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/db.server.ts)           |
| Job types (CreateJob, UpdateJob) | [packages/scms-core/src/backend/loaders/jobs/types.ts](packages/scms-core/src/backend/loaders/jobs/types.ts)                                         |
