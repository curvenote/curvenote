# SCMS Jobs – Developer guide

This document describes how jobs work in SCMS, how to use **dependent jobs** for chaining, and how to add new job types (core or extension). It is intended for developers working on the platform or writing extensions.

**Contents**

- [How jobs work](#how-jobs-work) – Create, run (sync/async), update, read
- [API reference](#api-reference) – Request/response for `POST` and `PATCH`
- [Dependent jobs](#dependent-jobs) – Chaining via `dependents` on `enqueueAndDispatchJob`
- [Adding a new job (core)](#adding-a-new-job-core-job-in-scms) – Steps and file reference
- [Extension jobs](#extension-jobs-no-change-to-core-names) – Add jobs without changing core

---

## How jobs work

1. **Create**  
   The app (or any authenticated client) sends `POST /api/v1/jobs` with `{ job_type, payload }`.  
   The API validates `job_type` and `payload`, enqueues the job row, and dispatches it to the queue. Job chaining is configured server-side via `dependents` on `enqueueAndDispatchJob` (see [Dependent jobs](#dependent-jobs)).

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
| `job_type`  | string | yes      | Registered job type (e.g. `CHECK`, `CONVERTER_TASK`).                 |
| `payload`   | object | yes      | Parameters for the job.                                               |
| `id`        | string | no       | UUID for the job; server generates one if omitted.                    |
| `results`   | object | no       | Pre-populated results (rare).                                         |

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
| `results` | object | no       | Job results (e.g. for CHECK, CONVERTER_TASK).                    |

**Authorization:** Curvenote auth or handshake token whose `jobId` claim matches `:jobId`.  
**Response:** `200` with updated job DTO. The route rejects PATCH when the job is already `COMPLETED` or `FAILED`.

---

## Dependent jobs

Job chaining uses **dependent job rows** created at enqueue time. The parent is dispatched immediately; dependents are inserted as `BLOCKED` and promoted when the parent reaches a terminal status.

- **Who triggers dependents:** `onJobTerminal` (called from `runHandler` and `PATCH /api/v1/jobs/:jobId`). It queries `depends_on_job_id` and `trigger_on`, then promotes or cancels each `BLOCKED` dependent.
- **Success vs failure:** Each dependent specifies `trigger_on: 'success' | 'failure'`. On parent `COMPLETED`, success-path dependents are queued; failure-path dependents are cancelled. On parent `FAILED` or `CANCELLED`, the reverse applies.
- **HTTP API:** `POST /api/v1/jobs` does not accept dependents. Configure chains in server code via `enqueueAndDispatchJob({ ..., dependents: [...] })`.

### Using dependents in code

Types `DependentJobSpec` and `EnqueueJobParams` are in `@curvenote/scms-core` ([packages/scms-core/src/backend/loaders/jobs/types.ts](packages/scms-core/src/backend/loaders/jobs/types.ts)).

```typescript
await enqueueAndDispatchJob({
  job_id: parentJobId,
  job_type: KnownJobTypes.CONVERTER_TASK,
  payload: { work_version_id, target: 'pdf' },
  invoked_by_id: userId,
  dependents: [
    {
      job_id: childJobId,
      job_type: 'MY_CHECK',
      payload: { work_version_id },
      trigger_on: 'success',
      activity_type: 'CHECK_STARTED',
    },
    {
      job_id: cleanupJobId,
      job_type: 'MY_FAILURE_CLEANUP',
      payload: { run_id },
      trigger_on: 'failure',
    },
  ],
});
```

See also [docs/jobs/queues-and-jobs.md](../../../docs/jobs/queues-and-jobs.md) for the dependency state diagram.

---

## Adding a new job (core job in SCMS)

To add a job like **Export to PDF** that triggers an async task:

| Step | What                         | Where                                                                                                                                                                                                                                |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Declare job type constant    | [packages/scms-core/src/backend/loaders/jobs/names.ts](packages/scms-core/src/backend/loaders/jobs/names.ts) – add to `KnownJobTypes`                                                                                                |
| 2    | Allow type in API validation | [packages/scms-server/src/api.schemas.ts](packages/scms-server/src/api.schemas.ts) – add to `coreJobTypes` in `getJobTypes()`                                                                                                        |
| 3    | Define payload schema        | [packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts) – e.g. `CreateConverterTaskPayloadSchema`                                       |
| 4    | Implement handler            | [packages/scms-server/src/backend/loaders/jobs/handlers/converter-task.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/converter-task.server.ts) – validate payload, `dbCreateJob`, enqueue (e.g. SNS), return job |
| 5    | Register handler             | [packages/scms-server/src/backend/loaders/jobs/handlers/index.ts](packages/scms-server/src/backend/loaders/jobs/handlers/index.ts) – add to `coreHandlers`                                                                           |
| 6    | (Optional) Storage           | [packages/scms-server/src/backend/loaders/jobs/create.server.ts](packages/scms-server/src/backend/loaders/jobs/create.server.ts) – add job type to `jobsRequiringStorage` only if the handler needs `StorageBackend`                 |

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
