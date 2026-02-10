# SCMS Jobs – Summary and Extension Points

## How jobs work

1. **Create**  
   The app (or any authenticated client) sends `POST /api/v1/jobs` with `{ job_type, payload }`.  
   The API validates `job_type` and `payload`, looks up the handler for that type, runs the handler, and returns the created job DTO. The handler is responsible for creating the job row (and optionally enqueueing an async task).

2. **Run**
   - **Sync**: The handler does all work and updates the job (e.g. PUBLISH, UNPUBLISH).
   - **Async**: The handler creates the job, publishes a message (e.g. SNS/PubSub) with a handshake token and `job_url`, and returns. A worker consumes the message, does the work, and updates the job via `PATCH /api/v1/jobs/:jobId` using the handshake token (e.g. CHECK, EXPORT_TO_PDF).

3. **Update**  
   `PATCH /api/v1/jobs/:jobId` with `{ status, message?, results? }` is allowed only when authorized by Curvenote auth or by a valid handshake token whose `jobId` claim matches the route param. Used by async workers to set COMPLETED/FAILED and attach results.

4. **Read**  
   `GET /api/v1/jobs/:jobId` returns the job DTO (payload, results, status, messages, links).

---

## Adding a new job (core job in SCMS)

To add a job like **Export to PDF** that triggers an async task:

| Step | What                         | Where                                                                                                                                                                                                                              |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Declare job type constant    | [packages/scms-core/src/backend/loaders/jobs/names.ts](packages/scms-core/src/backend/loaders/jobs/names.ts) – add to `KnownJobTypes`                                                                                              |
| 2    | Allow type in API validation | [packages/scms-server/src/api.schemas.ts](packages/scms-server/src/api.schemas.ts) – add to `coreJobTypes` in `getJobTypes()`                                                                                                      |
| 3    | Define payload schema        | [packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/schemas.server.ts) – e.g. `CreateExportToPdfJobPayloadSchema`                                    |
| 4    | Implement handler            | [packages/scms-server/src/backend/loaders/jobs/handlers/export-to-pdf.server.ts](packages/scms-server/src/backend/loaders/jobs/handlers/export-to-pdf.server.ts) – validate payload, `dbCreateJob`, enqueue (e.g. SNS), return job |
| 5    | Register handler             | [packages/scms-server/src/backend/loaders/jobs/handlers/index.ts](packages/scms-server/src/backend/loaders/jobs/handlers/index.ts) – add to `coreHandlers`                                                                         |
| 6    | (Optional) Storage           | [packages/scms-server/src/backend/loaders/jobs/create.server.ts](packages/scms-server/src/backend/loaders/jobs/create.server.ts) – add job type to `jobsRequiringStorage` only if the handler needs `StorageBackend`               |

**Trigger from the app**: `POST /api/v1/jobs` with body `{ "job_type": "EXPORT_TO_PDF", "payload": { "target": "..." } }`.  
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
